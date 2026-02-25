import type { ParsedConversation } from '../types';
import type { ParseOptions } from './parser-interface';
import { detectFormat } from './format-detector';
import { ChatGPTPasteParser } from './chatgpt-paste-parser';
import { ChatGPTJsonParser } from './chatgpt-json-parser';
import { ClaudePasteParser } from './claude-paste-parser';
import { ClaudeWebParser } from './claude-web-parser';
import { ClaudeJsonParser } from './claude-json-parser';
import { MarkdownParser } from './markdown-parser';
import type { IChatParser } from './parser-interface';

const pasteParsers: IChatParser[] = [
	new ChatGPTPasteParser(),
	new ClaudePasteParser(),
	new ClaudeWebParser(),
	new MarkdownParser(),
];

const jsonParsers: IChatParser[] = [
	new ChatGPTJsonParser(),
	new ClaudeJsonParser(),
];

const allParsers: IChatParser[] = [...jsonParsers, ...pasteParsers];

export function getAllParsers(): IChatParser[] {
	return [...allParsers];
}

export function parseInput(input: string, options?: ParseOptions): ParsedConversation {
	const format = detectFormat(input);

	if (format.method === 'file-json') {
		for (const parser of jsonParsers) {
			if (parser.canParse(input)) {
				return parser.parse(input, options);
			}
		}
		throw new Error(`No JSON parser could handle the input (detected: ${format.source}).`);
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
export { ChatGPTJsonParser } from './chatgpt-json-parser';
export { ClaudePasteParser } from './claude-paste-parser';
export { ClaudeWebParser } from './claude-web-parser';
export { ClaudeJsonParser } from './claude-json-parser';
export { MarkdownParser } from './markdown-parser';
export { listConversations } from './chatgpt-json-parser';
export { maskCodeBlocks, unmaskCodeBlocks } from './code-block-guard';
export type { IChatParser, InputFormat, ParseOptions } from './parser-interface';
