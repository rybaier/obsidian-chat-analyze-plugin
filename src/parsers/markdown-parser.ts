import type { ParsedConversation, Message, ContentType } from '../types';
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
		let contentType: ContentType = 'chat';

		if (detectedPattern) {
			messages = this.parseWithPattern(masked, blocks, detectedPattern, warnings);
		} else {
			const strippedMasked = this.stripFrontmatter(masked);
			const sectionMessages = this.splitBySections(strippedMasked, blocks);

			if (sectionMessages.length >= 2) {
				messages = sectionMessages;
				contentType = 'document';
			} else {
				const paragraphMessages = this.splitByParagraphGroups(strippedMasked, blocks);
				if (paragraphMessages.length >= 2) {
					messages = paragraphMessages;
					contentType = 'document';
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
			}
		}

		const title = this.extractTitle(messages);
		const frontmatterTitle = this.extractFrontmatterTitle(input);

		return {
			id: generateId(),
			title: frontmatterTitle || title,
			source: 'markdown',
			contentType,
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

	private stripFrontmatter(masked: string): string {
		return masked.replace(/^---\n[\s\S]*?\n---\n*/, '');
	}

	private splitBySections(masked: string, blocks: Map<string, string>): Message[] {
		const headingPattern = /^#{1,6}\s+/m;
		if (!headingPattern.test(masked)) return [];

		const lines = masked.split('\n');
		const sections: string[][] = [];
		let current: string[] = [];

		for (const line of lines) {
			if (/^#{1,6}\s+/.test(line)) {
				if (current.length > 0) {
					sections.push(current);
				}
				current = [line];
			} else {
				current.push(line);
			}
		}
		if (current.length > 0) {
			sections.push(current);
		}

		const messages: Message[] = [];
		let index = 0;

		for (const section of sections) {
			const raw = section.join('\n').trim();
			const content = unmaskCodeBlocks(raw, blocks);
			const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
			if (wordCount < 10) continue;

			const contentBlocks = parseContentBlocks(content);
			messages.push({
				id: generateId(),
				index,
				role: 'user',
				contentBlocks,
				plainText: content,
				timestamp: null,
				metadata: {},
			});
			index++;
		}

		return messages;
	}

	private splitByParagraphGroups(masked: string, blocks: Map<string, string>): Message[] {
		const paragraphs = masked.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 0);
		if (paragraphs.length < 4) return [];

		const groupSize = 3;
		const messages: Message[] = [];
		let index = 0;

		for (let i = 0; i < paragraphs.length; i += groupSize) {
			const group = paragraphs.slice(i, i + groupSize);
			const raw = group.join('\n\n');
			const content = unmaskCodeBlocks(raw, blocks);
			const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
			if (wordCount < 10) continue;

			const contentBlocks = parseContentBlocks(content);
			messages.push({
				id: generateId(),
				index,
				role: 'user',
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
