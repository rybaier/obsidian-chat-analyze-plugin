import type { ParsedConversation } from '../types';
import type { ParseOptions } from './parser-interface';
import { detectFormat } from './format-detector';
import { ChatGPTPasteParser } from './chatgpt-paste-parser';
import { ClaudePasteParser } from './claude-paste-parser';
import { MarkdownParser } from './markdown-parser';
import type { IChatParser } from './parser-interface';

const pasteParsers: IChatParser[] = [
	new ChatGPTPasteParser(),
	new ClaudePasteParser(),
	new MarkdownParser(),
];

export function getAllParsers(): IChatParser[] {
	return [...pasteParsers];
}

export function parseInput(input: string, options?: ParseOptions): ParsedConversation {
	const format = detectFormat(input);

	if (format.method === 'file-json') {
		throw new Error(`JSON file parsing is not yet implemented. Detected format: ${format.source} JSON.`);
	}

	for (const parser of pasteParsers) {
		if (parser.canParse(input)) {
			return parser.parse(input, options);
		}
	}

	throw new Error('No parser could handle the input.');
}

export { detectFormat } from './format-detector';
export { ChatGPTPasteParser } from './chatgpt-paste-parser';
export { ClaudePasteParser } from './claude-paste-parser';
export { MarkdownParser } from './markdown-parser';
export { maskCodeBlocks, unmaskCodeBlocks } from './code-block-guard';
export type { IChatParser, InputFormat, ParseOptions } from './parser-interface';
