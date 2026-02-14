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
		return titled.slice(0, MAX_TITLE_LENGTH - 3) + '...';
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

function toTitleCase(str: string): string {
	return str.replace(/\b\w/g, c => c.toUpperCase());
}
