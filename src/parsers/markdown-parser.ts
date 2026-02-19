import type { ParsedConversation, Message } from '../types';
import type { IChatParser, InputFormat, ParseOptions } from './parser-interface';
import { maskCodeBlocks, unmaskCodeBlocks } from './code-block-guard';
import { parseContentBlocks } from './content-block-parser';

interface SpeakerPattern {
	regex: RegExp;
	userLabels: string[];
	assistantLabels: string[];
}

const SPEAKER_PATTERNS: SpeakerPattern[] = [
	{
		regex: /^##\s+(User|Assistant)\s*$/im,
		userLabels: ['user'],
		assistantLabels: ['assistant'],
	},
	{
		regex: /^####\s+(You|ChatGPT)\s*:\s*$/im,
		userLabels: ['you'],
		assistantLabels: ['chatgpt'],
	},
	{
		regex: /^####\s+(Human|Assistant)\s*:\s*$/im,
		userLabels: ['human'],
		assistantLabels: ['assistant'],
	},
	{
		regex: /^\*\*(User|Assistant)\s*:\*\*\s*/im,
		userLabels: ['user'],
		assistantLabels: ['assistant'],
	},
];

function generateId(): string {
	return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
}

export class MarkdownParser implements IChatParser {
	readonly format: InputFormat = { source: 'markdown', method: 'paste' };

	canParse(): boolean {
		return true;
	}

	parse(input: string, options?: ParseOptions): ParsedConversation {
		const warnings: string[] = [];
		const { masked, blocks } = maskCodeBlocks(input);

		const detectedPattern = this.detectSpeakerPattern(masked);

		let messages: Message[];
		if (detectedPattern) {
			messages = this.parseWithPattern(masked, blocks, detectedPattern, warnings);
		} else {
			warnings.push('No speaker pattern detected. Treating entire input as a single message.');
			const content = unmaskCodeBlocks(input.trim(), blocks);
			const contentBlocks = parseContentBlocks(content);
			messages = [{
				id: generateId(),
				index: 0,
				role: 'user',
				contentBlocks,
				plainText: content,
				timestamp: null,
				metadata: {},
			}];
		}

		const title = this.extractTitle(messages);
		const frontmatterTitle = this.extractFrontmatterTitle(input);

		return {
			id: generateId(),
			title: frontmatterTitle || title,
			source: 'markdown',
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

	private detectSpeakerPattern(masked: string): SpeakerPattern | null {
		for (const pattern of SPEAKER_PATTERNS) {
			if (pattern.regex.test(masked)) {
				return pattern;
			}
		}
		return null;
	}

	private parseWithPattern(
		masked: string,
		blocks: Map<string, string>,
		pattern: SpeakerPattern,
		warnings: string[]
	): Message[] {
		const lines = masked.split('\n');
		const rawMessages: { role: 'user' | 'assistant'; lines: string[] }[] = [];
		let currentMessage: { role: 'user' | 'assistant'; lines: string[] } | null = null;

		const globalRegex = new RegExp(pattern.regex.source, 'im');

		for (const line of lines) {
			const match = globalRegex.exec(line);
			if (match) {
				if (currentMessage) {
					rawMessages.push(currentMessage);
				}
				const speaker = match[1].toLowerCase();
				const isUser = pattern.userLabels.includes(speaker);
				const remainder = line.slice(match[0].length);
				currentMessage = {
					role: isUser ? 'user' : 'assistant',
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

		return messages;
	}

	private extractTitle(messages: Message[]): string {
		const firstUser = messages.find(m => m.role === 'user');
		if (firstUser) {
			const text = firstUser.plainText.slice(0, 50);
			return text.length < firstUser.plainText.length ? text + '...' : text;
		}
		return 'Untitled Chat';
	}

	private extractFrontmatterTitle(input: string): string | null {
		const fmMatch = input.match(/^---\n([\s\S]*?)\n---/);
		if (!fmMatch) return null;
		const titleMatch = fmMatch[1].match(/^title:\s*(.+)$/m);
		return titleMatch ? titleMatch[1].trim().replace(/^["']|["']$/g, '') : null;
	}
}
