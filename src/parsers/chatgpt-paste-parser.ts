import type { ParsedConversation, Message } from '../types';
import type { IChatParser, InputFormat, ParseOptions } from './parser-interface';
import { maskCodeBlocks, unmaskCodeBlocks } from './code-block-guard';
import { parseContentBlocks } from './content-block-parser';

const SPEAKER_PATTERN = /^(You said|ChatGPT said|You|ChatGPT)\s*:\s*$/im;
const THOUGHT_PATTERN = /^Thought for .*$/im;

// Patterns that indicate assistant-style text, not user questions
const ASSISTANT_CONTINUATION_PATTERNS = [
	/^if you (tell|give|let|share|send|show)\s+me\b/i,
	/^if you'?d?\s+(like|prefer|want)\b/i,
	/^(i can|i'll|i will|i'd be happy to|let me)\b/i,
	/^(just tell|just let)\s+me\b/i,
	/^(for|from|with|given|based on)\s+(all|each|every|these|those|the|your|this|that)\b/i,
];

function generateId(): string {
	return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
}

function isThoughtLine(line: string): boolean {
	return THOUGHT_PATTERN.test(line.trim());
}

function isUserLikeParagraph(paragraph: string): boolean {
	const trimmed = paragraph.trim();
	// Reject URLs (image links, references pasted by assistant)
	if (/^https?:\/\//.test(trimmed)) return false;
	// Reject code fences
	if (/^```|^~~~/.test(trimmed)) return false;
	// Reject headings
	if (/^#{1,6}\s/.test(trimmed)) return false;
	// Reject list markers
	if (/^[\-*+]\s/.test(trimmed)) return false;
	// Reject numbered lists
	if (/^\d+\.\s/.test(trimmed)) return false;
	// Reject bold text
	if (/\*\*[^*]+\*\*/.test(trimmed)) return false;
	// Reject unicode em/en dashes (common in assistant formatted text, rare in user input)
	if (/[\u2014\u2013]/.test(trimmed)) return false;
	// Reject ellipsis start (assistant continuation "...I'll")
	if (/^[\u2026\.\.\.]/.test(trimmed)) return false;
	// Reject assistant-style continuation language
	for (const pattern of ASSISTANT_CONTINUATION_PATTERNS) {
		if (pattern.test(trimmed)) return false;
	}
	return true;
}

function splitIntoParagraphs(text: string): string[] {
	return text.split(/\n\n+/).filter((p) => p.trim().length > 0);
}

export class ChatGPTPasteParser implements IChatParser {
	readonly format: InputFormat = { source: 'chatgpt', method: 'paste' };

	canParse(input: string): boolean {
		return this.hasSpeakerLabels(input) || this.hasThoughtMarkers(input);
	}

	parse(input: string, options?: ParseOptions): ParsedConversation {
		if (this.hasSpeakerLabels(input)) {
			return this.parseLabeledPaste(input);
		}
		return this.parseUnlabeledPaste(input);
	}

	private hasSpeakerLabels(input: string): boolean {
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

	private hasThoughtMarkers(input: string): boolean {
		return /^Thought for /im.test(input);
	}

	private parseLabeledPaste(input: string): ParsedConversation {
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

		return this.buildResult(messages, warnings);
	}

	private parseUnlabeledPaste(input: string): ParsedConversation {
		const warnings: string[] = [];
		const { masked, blocks } = maskCodeBlocks(input);
		const lines = masked.split('\n');

		// Find all "Thought for" line indices
		const thoughtIndices: number[] = [];
		for (let i = 0; i < lines.length; i++) {
			if (isThoughtLine(lines[i])) {
				thoughtIndices.push(i);
			}
		}

		const rawMessages: { role: 'user' | 'assistant'; text: string }[] = [];

		// Section before first "Thought for" = first user message
		if (thoughtIndices.length > 0 && thoughtIndices[0] > 0) {
			const section0 = lines.slice(0, thoughtIndices[0]).join('\n').trim();
			if (section0) {
				rawMessages.push({ role: 'user', text: section0 });
			}
		}

		// Process each "Thought for" section
		for (let i = 0; i < thoughtIndices.length; i++) {
			const sectionStart = thoughtIndices[i] + 1;
			const sectionEnd =
				i + 1 < thoughtIndices.length
					? thoughtIndices[i + 1]
					: lines.length;

			const sectionText = lines.slice(sectionStart, sectionEnd).join('\n').trim();
			if (!sectionText) {
				warnings.push(
					`Empty section after "Thought for" at line ${thoughtIndices[i] + 1} was skipped`
				);
				continue;
			}

			const isLastSection = i === thoughtIndices.length - 1;

			if (isLastSection) {
				rawMessages.push({ role: 'assistant', text: sectionText });
			} else {
				// Backward-scan to separate trailing user message from assistant content
				const paragraphs = splitIntoParagraphs(sectionText);

				if (paragraphs.length === 0) {
					continue;
				}

				let userStartIdx = paragraphs.length;
				for (let j = paragraphs.length - 1; j >= 0; j--) {
					if (isUserLikeParagraph(paragraphs[j].trim())) {
						userStartIdx = j;
					} else {
						break;
					}
				}

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

		return this.buildResult(messages, warnings);
	}

	private buildResult(messages: Message[], warnings: string[]): ParsedConversation {
		const title = this.extractTitle(messages);

		return {
			id: generateId(),
			title,
			source: 'chatgpt',
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
