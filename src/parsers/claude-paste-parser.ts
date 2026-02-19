import type { ParsedConversation, Message } from '../types';
import type { IChatParser, InputFormat, ParseOptions } from './parser-interface';
import { maskCodeBlocks, unmaskCodeBlocks } from './code-block-guard';
import { parseContentBlocks } from './content-block-parser';

const SPEAKER_PATTERN = /^(Human|Assistant|Claude)\s*:\s*/im;

function generateId(): string {
	return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
}

export class ClaudePasteParser implements IChatParser {
	readonly format: InputFormat = { source: 'claude', method: 'paste' };

	canParse(input: string): boolean {
		const lines = input.split('\n');
		let hasHuman = false;
		let hasAssistant = false;
		for (const line of lines) {
			const trimmed = line.trim();
			if (/^Human\s*:/i.test(trimmed)) hasHuman = true;
			if (/^(Assistant|Claude)\s*:/i.test(trimmed)) hasAssistant = true;
			if (hasHuman && hasAssistant) return true;
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
			const match = SPEAKER_PATTERN.exec(line);
			if (match) {
				if (currentMessage) {
					rawMessages.push(currentMessage);
				}
				const speaker = match[1].toLowerCase();
				const role: 'user' | 'assistant' = speaker === 'human' ? 'user' : 'assistant';
				const remainder = line.slice(match[0].length);
				currentMessage = {
					role,
					lines: remainder.trim() ? [remainder] : [],
				};
				continue;
			}

			if (currentMessage) {
				currentMessage.lines.push(line);
			}
		}

		if (currentMessage) {
			rawMessages.push(currentMessage);
		}

		const messages: Message[] = [];
		let index = 0;

		for (const raw of rawMessages) {
			const content = unmaskCodeBlocks(raw.lines.join('\n').trim(), blocks);
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
			source: 'claude',
			contentType: 'chat',
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
		const firstUser = messages.find(m => m.role === 'user');
		if (firstUser) {
			const text = firstUser.plainText.slice(0, 50);
			return text.length < firstUser.plainText.length ? text + '...' : text;
		}
		return 'Untitled Chat';
	}
}
