const FENCE_PATTERN = /^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^\1\s*$/gm;

export interface MaskResult {
	masked: string;
	blocks: Map<string, string>;
}

export function maskCodeBlocks(input: string): MaskResult {
	const blocks = new Map<string, string>();
	let counter = 0;

	const masked = input.replace(FENCE_PATTERN, (match, fence, lang, content) => {
		const placeholder = `__CODE_BLOCK_${counter}__`;
		blocks.set(placeholder, match);
		counter++;
		return placeholder;
	});

	return { masked, blocks };
}

export function unmaskCodeBlocks(content: string, blocks: Map<string, string>): string {
	let result = content;
	for (const [placeholder, original] of blocks) {
		result = result.replace(placeholder, original);
	}
	return result;
}
