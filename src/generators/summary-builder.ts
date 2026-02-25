import type { Message } from '../types';
import {
	stripMarkdown,
	extractFirstSentence,
	FILLER_PREFIXES,
	ACTION_VERB_PATTERNS,
	stripFillerAndActions,
} from '../segmentation/title-generator';
import { extractLinks } from './key-info-extractor';

const MAX_QUESTIONS = 8;
const MAX_TOPICS = 8;
const MAX_TAKEAWAYS = 6;
const MAX_ITEM_LENGTH = 200;

const GREETING_PATTERN = /^(sure|absolutely|of course|great question|good question|certainly|definitely|i'?d be happy to|i can help|happy to help|here'?s|let me|okay|yes)[,!.]?\s*/i;

const TAKEAWAY_PATTERNS = [
	/\brecommend\b/i,
	/\bsuggest\b/i,
	/\bshould\s+consider\b/i,
	/\bkey\s+takeaway\b/i,
	/\bin\s+summary\b/i,
	/\bin\s+conclusion\b/i,
	/\bmost\s+important\b/i,
	/\bthe\s+best\s+option\b/i,
	/\bto\s+summarize\b/i,
	/\bbottom\s+line\b/i,
	/\boverall\b/i,
	/\bultimately\b/i,
	/\bmy\s+advice\b/i,
	/\bthe\s+main\b/i,
	/\bi'?d\s+go\s+with\b/i,
	/\byou'?ll\s+want\s+to\b/i,
	/\bthe\s+key\s+(?:thing|point|factor)\b/i,
];

function cleanMarkdownInline(text: string): string {
	return text
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/\*([^*]+)\*/g, '$1')
		.replace(/`([^`]+)`/g, '$1')
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/~~([^~]+)~~/g, '$1');
}

function normalize(text: string): string {
	return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function isDuplicate(item: string, existing: string[]): boolean {
	const norm = normalize(item);
	return existing.some(e => {
		const ne = normalize(e);
		return ne === norm || ne.includes(norm) || norm.includes(ne);
	});
}

function truncateItem(text: string): string {
	if (text.length <= MAX_ITEM_LENGTH) return text;
	const sentenceEnd = text.slice(0, MAX_ITEM_LENGTH).match(/^[^.!?]*[.!?]/);
	if (sentenceEnd) return sentenceEnd[0].trim();
	const lastSpace = text.lastIndexOf(' ', MAX_ITEM_LENGTH);
	if (lastSpace > MAX_ITEM_LENGTH * 0.5) return text.slice(0, lastSpace) + '...';
	return text.slice(0, MAX_ITEM_LENGTH) + '...';
}

export function extractQuestions(messages: Message[]): string[] {
	const userMessages = messages.filter(m => m.role === 'user');
	const questions: string[] = [];

	for (const msg of userMessages) {
		const text = stripMarkdown(msg.plainText.trim());
		if (!text) continue;

		let sentence = extractFirstSentence(text);
		sentence = stripFillerAndActions(sentence);
		sentence = sentence.replace(/^[,;:.!?\-]+\s*/, '').trim();

		if (sentence.length < 5) continue;

		const cleaned = cleanMarkdownInline(sentence);
		if (cleaned.length < 5) continue;

		const truncated = truncateItem(cleaned);
		if (!isDuplicate(truncated, questions)) {
			questions.push(truncated);
		}

		if (questions.length >= MAX_QUESTIONS) break;
	}

	return questions;
}

export function extractTopics(messages: Message[]): string[] {
	const assistantMessages = messages.filter(m => m.role === 'assistant');
	if (assistantMessages.length === 0) return [];

	const topics: string[] = [];

	// Try extracting from headings
	for (const msg of assistantMessages) {
		const lines = msg.plainText.split('\n');
		for (const line of lines) {
			const match = line.match(/^#{2,4}\s+(.+)/);
			if (!match) continue;

			let text = match[1].trim();
			text = cleanMarkdownInline(text);
			// Strip numbering prefixes
			text = text.replace(/^(\d+\.\s*|step\s+\d+[:.]\s*|part\s+[a-z0-9]+[:.]\s*)/i, '').trim();

			if (text.length < 3) continue;

			const truncated = truncateItem(text);
			if (!isDuplicate(truncated, topics)) {
				topics.push(truncated);
			}

			if (topics.length >= MAX_TOPICS) break;
		}
		if (topics.length >= MAX_TOPICS) break;
	}

	// Fallback: first meaningful sentence from each assistant response
	if (topics.length === 0) {
		for (const msg of assistantMessages) {
			const text = msg.plainText.trim();
			const lines = text.split('\n')
				.map(l => l.trim())
				.filter(l => l.length >= 15)
				.filter(l => !/^#{1,6}\s/.test(l))
				.filter(l => !/^[-*+]\s/.test(l))
				.filter(l => !/^\d+\.\s/.test(l))
				.filter(l => !/^[-=]{3,}$/.test(l))
				.filter(l => !/^```/.test(l))
				.filter(l => !/(https?:)?\/\/\S+/.test(l));

			if (lines.length === 0) continue;

			let opening = lines[0];
			opening = opening.replace(GREETING_PATTERN, '').trim();
			if (opening.length < 10) continue;

			const sentenceMatch = opening.match(/^[^.!?]*[.!?]/);
			let sentence = sentenceMatch
				? sentenceMatch[0].trim()
				: opening.slice(0, 150).trim();

			sentence = cleanMarkdownInline(sentence);
			if (sentence.length < 10) continue;

			const truncated = truncateItem(sentence);
			if (!isDuplicate(truncated, topics)) {
				topics.push(truncated);
			}

			if (topics.length >= MAX_TOPICS) break;
		}
	}

	return topics;
}

export function extractTakeaways(messages: Message[]): string[] {
	const assistantMessages = messages.filter(m => m.role === 'assistant');
	if (assistantMessages.length === 0) return [];

	const takeaways: string[] = [];

	// Scan for recommendation/conclusion pattern sentences
	for (const msg of assistantMessages) {
		const sentences = splitIntoSentences(msg.plainText);
		for (const sentence of sentences) {
			if (sentence.length < 15) continue;

			const matchesPattern = TAKEAWAY_PATTERNS.some(p => p.test(sentence));
			if (!matchesPattern) continue;

			let cleaned = cleanMarkdownInline(sentence).trim();
			// Strip leading list markers that survived
			cleaned = cleaned.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '');

			if (cleaned.length < 15) continue;

			const truncated = truncateItem(cleaned);
			if (!isDuplicate(truncated, takeaways)) {
				takeaways.push(truncated);
			}

			if (takeaways.length >= MAX_TAKEAWAYS) break;
		}
		if (takeaways.length >= MAX_TAKEAWAYS) break;
	}

	// Extract bold recommendations: **bold text** containing actionable language
	if (takeaways.length < MAX_TAKEAWAYS) {
		for (const msg of assistantMessages) {
			const boldMatches = msg.plainText.matchAll(/\*\*([^*]{15,})\*\*/g);
			for (const match of boldMatches) {
				const text = match[1].trim();
				if (text.length < 15) continue;

				const hasActionableLanguage = TAKEAWAY_PATTERNS.some(p => p.test(text));
				if (!hasActionableLanguage) continue;

				const truncated = truncateItem(text);
				if (!isDuplicate(truncated, takeaways)) {
					takeaways.push(truncated);
				}

				if (takeaways.length >= MAX_TAKEAWAYS) break;
			}
			if (takeaways.length >= MAX_TAKEAWAYS) break;
		}
	}

	// Try final paragraph of last assistant message as conclusion
	if (takeaways.length === 0 && assistantMessages.length > 0) {
		const lastMsg = assistantMessages[assistantMessages.length - 1];
		const paragraphs = lastMsg.plainText.split(/\n\n+/).filter(p => p.trim().length > 0);
		if (paragraphs.length > 1) {
			const lastParagraph = paragraphs[paragraphs.length - 1].trim();
			// Only use if it looks like a conclusion (not a code block or list)
			if (lastParagraph.length >= 20
				&& !lastParagraph.startsWith('```')
				&& !/^[-*+]\s/.test(lastParagraph)
				&& !/^\d+\.\s/.test(lastParagraph)
			) {
				const sentenceMatch = lastParagraph.match(/^[^.!?]*[.!?]/);
				const sentence = sentenceMatch
					? sentenceMatch[0].trim()
					: lastParagraph.slice(0, 200).trim();

				const cleaned = cleanMarkdownInline(sentence);
				if (cleaned.length >= 15) {
					takeaways.push(truncateItem(cleaned));
				}
			}
		}
	}

	return takeaways;
}

function splitIntoSentences(text: string): string[] {
	// Strip code blocks first to avoid matching inside them
	const stripped = text.replace(/```[\s\S]*?```/g, '');
	const sentences: string[] = [];

	// Split on sentence-ending punctuation followed by space or newline
	const parts = stripped.split(/(?<=[.!?])\s+/);
	for (const part of parts) {
		const trimmed = part.trim();
		if (trimmed.length > 0) {
			sentences.push(trimmed);
		}
	}

	return sentences;
}

export function buildSummaryBlock(
	messages: Message[],
	segmentSummary: string,
	tags: string[]
): string {
	const sections: string[] = [];

	// Summary section (always shown)
	const tagLine = tags.length > 0
		? `\n> **Tags:** ${tags.map(t => '`' + t + '`').join(' ')}`
		: '';
	sections.push(`> [!abstract] Summary\n> ${segmentSummary}${tagLine}`);

	// Questions Asked
	const questions = extractQuestions(messages);
	if (questions.length > 0) {
		const questionLines = questions.map((q, i) => `> ${i + 1}. ${q}`).join('\n');
		sections.push(`> [!question] Questions Asked\n${questionLines}`);
	}

	// Topics Covered
	const topics = extractTopics(messages);
	if (topics.length > 0) {
		const topicLines = topics.map(t => `> - ${t}`).join('\n');
		sections.push(`> [!list] Topics Covered\n${topicLines}`);
	}

	// Key Takeaways
	const takeaways = extractTakeaways(messages);
	if (takeaways.length > 0) {
		const takeawayLines = takeaways.map(t => `> - ${t}`).join('\n');
		sections.push(`> [!tip] Key Takeaways\n${takeawayLines}`);
	}

	// References (links)
	const links = extractLinks(messages);
	if (links.length > 0) {
		const linkLines = links.map(l => `> - ${l}`).join('\n');
		sections.push(`> [!link] References\n${linkLines}`);
	}

	return sections.join('\n\n');
}
