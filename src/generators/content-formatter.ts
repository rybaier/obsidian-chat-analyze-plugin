import type { Message, ContentBlock, SpeakerStyle } from '../types';

export interface FormatOptions {
	collapseLong: boolean;
	collapseThreshold: number;
	showTimestamps: boolean;
}

export function formatMessages(
	messages: Message[],
	style: SpeakerStyle,
	options: FormatOptions
): string {
	const formatted: string[] = [];

	for (const message of messages) {
		if (message.role === 'system' || message.role === 'tool') continue;

		const content = renderContentBlocks(message.contentBlocks, style);
		const wordCount = message.plainText.split(/\s+/).length;
		const isLong = options.collapseLong && wordCount > options.collapseThreshold;
		const roleLabel = message.role === 'user' ? 'User' : 'Assistant';

		let timestamp = '';
		if (options.showTimestamps && message.timestamp) {
			timestamp = ` (${message.timestamp.toISOString().slice(0, 16).replace('T', ' ')})`;
		}

		switch (style) {
			case 'callouts':
				formatted.push(formatCallout(roleLabel, content, isLong, timestamp, message));
				break;
			case 'blockquotes':
				formatted.push(formatBlockquote(roleLabel, content, timestamp));
				break;
			case 'bold':
				formatted.push(formatBold(roleLabel, content, timestamp));
				break;
		}
	}

	return formatted.join('\n\n');
}

function formatCallout(
	roleLabel: string,
	content: string,
	isLong: boolean,
	timestamp: string,
	message: Message
): string {
	const calloutType = roleLabel.toLowerCase();
	const collapse = isLong ? '-' : '';
	const header = `> [!${calloutType}]${collapse} ${roleLabel}${timestamp}`;

	const parts: string[] = [];

	for (const block of message.contentBlocks) {
		if (block.type !== 'thinking') continue;
		const thinkingContent = prefixLines(block.content, '> ');
		parts.push(`> [!thinking]- Thinking\n${thinkingContent}`);
	}

	const calloutContent = prefixLines(content, '> ');
	parts.push(`${header}\n${calloutContent}`);

	return parts.join('\n\n');
}

function formatBlockquote(roleLabel: string, content: string, timestamp: string): string {
	const quotedContent = prefixLines(content, '> ');
	return `**${roleLabel}:**${timestamp}\n${quotedContent}`;
}

function formatBold(roleLabel: string, content: string, timestamp: string): string {
	return `**${roleLabel}:**${timestamp} ${content}`;
}

function renderContentBlocks(blocks: ContentBlock[], style: SpeakerStyle): string {
	const parts: string[] = [];

	for (const block of blocks) {
		switch (block.type) {
			case 'text':
				parts.push(block.content);
				break;
			case 'code':
				parts.push(`\`\`\`${block.language}\n${block.content}\n\`\`\``);
				break;
			case 'thinking':
				break;
			case 'artifact': {
				if (style === 'callouts') {
					const lang = block.language ? `\`\`\`${block.language}\n${block.content}\n\`\`\`` : block.content;
					parts.push(`> [!note] Artifact: ${block.title}\n> ${lang.split('\n').join('\n> ')}`);
				} else {
					parts.push(`**Artifact: ${block.title}**\n${block.content}`);
				}
				break;
			}
			case 'tool_use':
				break;
			case 'image':
				if (block.url) {
					parts.push(`![${block.altText}](${block.url})`);
				} else {
					parts.push(`[Image: ${block.altText}]`);
				}
				break;
		}
	}

	return parts.join('\n\n');
}

function prefixLines(content: string, prefix: string): string {
	return content.split('\n').map(line => `${prefix}${line}`).join('\n');
}
