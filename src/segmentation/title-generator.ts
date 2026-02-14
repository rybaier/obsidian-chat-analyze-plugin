import type { Message } from '../types';
import { tokenize, removeStopWords } from '../utils/stop-words';

const FILLER_PREFIXES = [
	/^(can you|could you|please|would you|i want you to|help me|i need you to)\s+/i,
];

const MAX_TITLE_LENGTH = 50;

export function generateTitle(messages: Message[]): string {
	const firstUser = messages.find(m => m.role === 'user');
	if (!firstUser) {
		return generateFromKeywords(messages);
	}

	const text = firstUser.plainText.trim();
	let sentence = extractFirstSentence(text);

	for (const pattern of FILLER_PREFIXES) {
		sentence = sentence.replace(pattern, '');
	}

	sentence = sentence.trim();

	if (sentence.length > 0) {
		const titled = toTitleCase(sentence);
		if (titled.length <= MAX_TITLE_LENGTH) return titled;
		return truncateAtWord(titled, MAX_TITLE_LENGTH);
	}

	return generateFromKeywords(messages);
}

function extractFirstSentence(text: string): string {
	const firstLine = text.split('\n')[0];
	const sentenceMatch = firstLine.match(/^[^.!?]*[.!?]/);
	if (sentenceMatch) {
		return sentenceMatch[0].replace(/[.!?]$/, '').trim();
	}
	return firstLine.slice(0, 80).trim();
}

function generateFromKeywords(messages: Message[]): string {
	const allText = messages.map(m => m.plainText).join(' ');
	const tokens = removeStopWords(tokenize(allText));

	const freq = new Map<string, number>();
	for (const token of tokens) {
		freq.set(token, (freq.get(token) || 0) + 1);
	}

	const sorted = [...freq.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3)
		.map(([word]) => word);

	if (sorted.length === 0) return 'Untitled Topic';

	return toTitleCase(sorted.join(' '));
}

function truncateAtWord(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	const truncated = text.slice(0, maxLength);
	const lastSpace = truncated.lastIndexOf(' ');
	if (lastSpace > maxLength * 0.5) {
		return truncated.slice(0, lastSpace);
	}
	return truncated;
}

const MINOR_WORDS = new Set([
	'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at',
	'to', 'by', 'of', 'in', 'is', 'it', 'vs', 'with', 'as', 'if',
]);

function toTitleCase(str: string): string {
	return str
		.split(/\s+/)
		.map((word, i) => {
			if (word === word.toUpperCase() && word.length >= 2 && /^[A-Z]+$/.test(word)) {
				return word;
			}
			const lower = word.toLowerCase();
			if (i === 0 || !MINOR_WORDS.has(lower)) {
				return lower.charAt(0).toUpperCase() + lower.slice(1);
			}
			return lower;
		})
		.join(' ');
}
