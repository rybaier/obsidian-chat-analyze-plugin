import type { ContentBlock } from '../types';

const CODE_FENCE_PATTERN = /^(`{3,}|~{3,})(\w*)\s*\n?([\s\S]*?)^\1\s*$/gm;

export function parseContentBlocks(content: string): ContentBlock[] {
	const blocks: ContentBlock[] = [];
	let lastIndex = 0;

	const matches = Array.from(content.matchAll(CODE_FENCE_PATTERN));

	if (matches.length === 0) {
		return [{ type: 'text', content }];
	}

	for (const match of matches) {
		const matchStart = match.index!;
		const matchEnd = matchStart + match[0].length;

		if (matchStart > lastIndex) {
			const textBefore = content.slice(lastIndex, matchStart).trim();
			if (textBefore) {
				blocks.push({ type: 'text', content: textBefore });
			}
		}

		blocks.push({
			type: 'code',
			language: match[2] || '',
			content: match[3].trimEnd(),
		});

		lastIndex = matchEnd;
	}

	if (lastIndex < content.length) {
		const textAfter = content.slice(lastIndex).trim();
		if (textAfter) {
			blocks.push({ type: 'text', content: textAfter });
		}
	}

	return blocks;
}
