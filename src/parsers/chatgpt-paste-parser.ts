import type { ParsedConversation, Message, ContentBlock } from '../types';
import type { IChatParser, InputFormat, ParseOptions } from './parser-interface';
import { maskCodeBlocks, unmaskCodeBlocks } from './code-block-guard';
import { parseContentBlocks } from './content-block-parser';
import { generateTitle } from '../segmentation/title-generator';

const SPEAKER_PATTERN = /^(You said|ChatGPT said|You|ChatGPT)\s*:\s*$/im;
const THOUGHT_PATTERN = /^Thought for .*$/im;

function generateId(): string {
	return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
}

export class ChatGPTPasteParser implements IChatParser {
	readonly format: InputFormat = { source: 'chatgpt', method: 'paste' };

	canParse(input: string): boolean {
		const lines = input.split('\n');
		let hasYou = false;
		let hasChatGPT = false;
		for (const line of lines) {
			const trimmed = line.trim();
			if (/^(You said|You)\s*:$/i.test(trimmed)) hasYou = true;
			if (/^(ChatGPT said|ChatGPT)\s*:$/i.test(trimmed)) hasChatGPT = true;
			if (hasYou && hasChatGPT) return true;
		}
		return false;
	}

	parse(input: string, options?: ParseOptions): ParsedConversation {
		const warnings: string[] = [];
		const { masked, blocks } = maskCodeBlocks(input);

		const lines = masked.split('\n');
		const rawMessages: { role: 'user' | 'assistant'; lines: string[] }[] = [];
		let currentMessage: { role: 'user' | 'assistant'; lines: string[] } | null = null;

		for (const line of lines) {
			const trimmed = line.trim();

			if (SPEAKER_PATTERN.test(trimmed)) {
				if (currentMessage) {
					rawMessages.push(currentMessage);
				}
				const isUser = /^(You said|You)\s*:/i.test(trimmed);
				currentMessage = {
					role: isUser ? 'user' : 'assistant',
					lines: [],
				};
				continue;
			}

			if (currentMessage) {
				if (currentMessage.role === 'assistant' && currentMessage.lines.length === 0 && THOUGHT_PATTERN.test(trimmed)) {
					continue;
				}
				currentMessage.lines.push(line);
			}
		}

		if (currentMessage) {
			rawMessages.push(currentMessage);
		}

		const messages: Message[] = [];
		let index = 0;

		for (const raw of rawMessages) {
			let joined = raw.lines.join('\n').trim();

			if (raw.role === 'assistant') {
				joined = joined.replace(/^Thought for [\w\s]+\n*/i, '').trim();
			}

			const content = unmaskCodeBlocks(joined, blocks);
			if (!content) {
				warnings.push(`Empty ${raw.role} message at position ${index} was skipped`);
				continue;
			}

			const contentBlocks = parseContentBlocks(content);
			messages.push({
				id: generateId(),
				index,
				role: raw.role,
				contentBlocks,
				plainText: content,
				timestamp: null,
				metadata: {},
			});
			index++;
		}

		const title = this.extractTitle(messages);

		return {
			id: generateId(),
			title,
			source: 'chatgpt',
			inputMethod: 'paste',
			createdAt: null,
			updatedAt: null,
			messages,
			messageCount: messages.length,
			parseWarnings: warnings,
			sourceMetadata: {},
		};
	}

	private extractTitle(messages: Message[]): string {
		return generateTitle(messages);
	}
}
