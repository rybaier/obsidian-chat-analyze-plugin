import type { ParsedConversation, Message } from '../types';
import type { IChatParser, InputFormat, ParseOptions } from './parser-interface';
import { maskCodeBlocks, unmaskCodeBlocks } from './code-block-guard';
import { parseContentBlocks } from './content-block-parser';

const DATE_STAMP_PATTERN =
	/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}$/;

const SPEAKER_LABEL_PATTERN = /^(Human|Assistant|Claude)\s*:/im;

const MAX_USER_PARAGRAPH_LENGTH = 300;

function generateId(): string {
	return crypto.randomUUID
		? crypto.randomUUID()
		: Math.random().toString(36).slice(2, 10);
}

function isDateStampLine(line: string): boolean {
	return DATE_STAMP_PATTERN.test(line.trim());
}

function isUserLikeParagraph(paragraph: string): boolean {
	if (paragraph.length > MAX_USER_PARAGRAPH_LENGTH) return false;
	if (/^```|^~~~/.test(paragraph)) return false;
	if (/^#{1,6}\s/.test(paragraph)) return false;
	if (/^[\-*+]\s/.test(paragraph)) return false;
	if (/^\d+\.\s/.test(paragraph)) return false;
	if (/\*\*[^*]+\*\*/.test(paragraph)) return false;
	return true;
}

function splitIntoParagraphs(text: string): string[] {
	return text.split(/\n\n+/).filter((p) => p.trim().length > 0);
}

export class ClaudeWebParser implements IChatParser {
	readonly format: InputFormat = { source: 'claude', method: 'paste' };

	canParse(input: string): boolean {
		if (SPEAKER_LABEL_PATTERN.test(input)) {
			return false;
		}

		const { masked } = maskCodeBlocks(input);
		const lines = masked.split('\n');
		let dateCount = 0;

		for (const line of lines) {
			if (isDateStampLine(line)) {
				dateCount++;
				if (dateCount >= 2) return true;
			}
		}

		return false;
	}

	parse(input: string, _options?: ParseOptions): ParsedConversation {
		const warnings: string[] = [];
		const { masked, blocks } = maskCodeBlocks(input);
		const lines = masked.split('\n');

		const dateLineIndices: number[] = [];
		for (let i = 0; i < lines.length; i++) {
			if (isDateStampLine(lines[i])) {
				dateLineIndices.push(i);
			}
		}

		const rawMessages: { role: 'user' | 'assistant'; text: string }[] = [];

		// Section 0: everything before the first date stamp = first user message
		if (dateLineIndices.length > 0 && dateLineIndices[0] > 0) {
			const section0 = lines.slice(0, dateLineIndices[0]).join('\n').trim();
			if (section0) {
				rawMessages.push({ role: 'user', text: section0 });
			}
		}

		// Process each date section
		for (let i = 0; i < dateLineIndices.length; i++) {
			const sectionStart = dateLineIndices[i] + 1;
			const sectionEnd =
				i + 1 < dateLineIndices.length
					? dateLineIndices[i + 1]
					: lines.length;

			const sectionText = lines.slice(sectionStart, sectionEnd).join('\n').trim();
			if (!sectionText) {
				warnings.push(
					`Empty section after date stamp at line ${dateLineIndices[i] + 1} was skipped`
				);
				continue;
			}

			const isLastSection = i === dateLineIndices.length - 1;

			if (isLastSection) {
				// Final section after last date = assistant only (no following user turn)
				rawMessages.push({ role: 'assistant', text: sectionText });
			} else {
				// Backward-scan to separate trailing user message from assistant content
				const paragraphs = splitIntoParagraphs(sectionText);

				if (paragraphs.length === 0) {
					continue;
				}

				// Find trailing user-like paragraphs
				let userStartIdx = paragraphs.length;
				for (let j = paragraphs.length - 1; j >= 0; j--) {
					if (isUserLikeParagraph(paragraphs[j].trim())) {
						userStartIdx = j;
					} else {
						break;
					}
				}

				// If backward scan would consume the entire section, treat it all as assistant
				if (userStartIdx === 0) {
					rawMessages.push({ role: 'assistant', text: sectionText });
				} else {
					const assistantText = paragraphs.slice(0, userStartIdx).join('\n\n');
					const userText = paragraphs.slice(userStartIdx).join('\n\n');

					if (assistantText.trim()) {
						rawMessages.push({ role: 'assistant', text: assistantText });
					}
					if (userText.trim()) {
						rawMessages.push({ role: 'user', text: userText });
					}
				}
			}
		}

		// Build final messages
		const messages: Message[] = [];
		let index = 0;

		for (const raw of rawMessages) {
			const content = unmaskCodeBlocks(raw.text.trim(), blocks);
			if (!content) {
				warnings.push(
					`Empty ${raw.role} message at position ${index} was skipped`
				);
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
		const firstUser = messages.find((m) => m.role === 'user');
		if (firstUser) {
			const text = firstUser.plainText.slice(0, 50);
			return text.length < firstUser.plainText.length ? text + '...' : text;
		}
		return 'Untitled Chat';
	}
}
