import type { Message } from '../types';
import { tokenize, removeStopWords } from '../utils/stop-words';

const FILLER_PREFIXES = [
	/^(can you|could you|please|would you|i want you to|help me|i need you to)[,;:.!?]?\s+/i,
	/^(ok so|ok perfect|ok great|ok|perfect|great|awesome|thanks|thank you|alright so|alright|yeah so|yeah|sure|got it|so)[,;:.!?]?\s+/i,
];

const CONTEXTUAL_REFS = /\b(number\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)|option\s+[a-d]|#\d+)\b\s*/gi;

const MAX_TITLE_LENGTH = 72;

export function generateTitle(messages: Message[]): string {
	const firstUser = messages.find(m => m.role === 'user');
	if (!firstUser) {
		return generateFromKeywords(messages);
	}

	const text = firstUser.plainText.trim();
	let sentence = extractFirstSentence(text);

	// Iteratively strip filler prefixes until none match
	let changed = true;
	while (changed) {
		changed = false;
		for (const pattern of FILLER_PREFIXES) {
			const stripped = sentence.replace(pattern, '');
			if (stripped !== sentence) {
				sentence = stripped.trim();
				// Strip leading punctuation left behind (e.g. ", can you..." after "thank you" removal)
				sentence = sentence.replace(/^[,;:.!?\-]+\s*/, '');
				changed = true;
			}
		}
	}

	// Strip contextual references that are meaningless in isolation
	sentence = sentence.replace(CONTEXTUAL_REFS, '').trim();

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
		const extracted = sentenceMatch[0].replace(/[.!?]$/, '').trim();
		// If the first sentence is very short, try to grab more context
		if (extracted.length < 15) {
			return firstLine.slice(0, 120).trim();
		}
		return extracted;
	}
	return firstLine.slice(0, 120).trim();
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

	// Prefer breaking at phrase boundaries: commas, semicolons, colons,
	// or before conjunctions ("and", "or", "but")
	const phraseBoundary = truncated.match(/^(.+)[,;:](?:\s|$)/);
	if (phraseBoundary && phraseBoundary[1].length > maxLength * 0.4) {
		return phraseBoundary[1].trim();
	}

	// Try breaking before a conjunction
	const conjunctionBreak = truncated.match(/^(.+)\s+(?:and|or|but)\s+/i);
	if (conjunctionBreak && conjunctionBreak[1].length > maxLength * 0.4) {
		return conjunctionBreak[1].trim();
	}

	// Fall back to last word boundary
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
