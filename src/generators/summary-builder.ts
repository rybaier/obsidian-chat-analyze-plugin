import type { Message } from '../types';
import {
	stripMarkdown,
	extractFirstSentence,
	FILLER_PREFIXES,
	ACTION_VERB_PATTERNS,
	stripFillerAndActions,
	stripLeadingArtifacts,
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

const QUESTION_WORD_PATTERN = /^(what|where|when|which|who|whom|whose|why|how|is|are|was|were|do|does|did|can|could|would|should|will|shall|has|have|had)\b/i;
const REQUEST_PATTERN = /^(tell me|show me|explain|describe|help me|give me|list|compare|break down|walk me through)\b/i;
const CONVERSATIONAL_ACK_PATTERN = /^(got it|great|thanks|thank you|ok|okay|sure|perfect|awesome|right|yeah|yep|yes|no|alright|absolutely|hmm|ah|oh|well|so|cool|nice|interesting|understood|noted)\b/i;

function isLikelyQuestion(text: string): boolean {
	// Ends with question mark
	if (/\?\s*$/.test(text)) return true;
	// Starts with question word
	if (QUESTION_WORD_PATTERN.test(text)) return true;
	// Request phrasing
	if (REQUEST_PATTERN.test(text)) return true;
	return false;
}

function isConversationalFragment(text: string): boolean {
	// Starts with conversational acknowledgment
	if (CONVERSATIONAL_ACK_PATTERN.test(text)) return true;
	// Too short to be a meaningful topic (under 20 chars)
	if (text.length < 20) return true;
	return false;
}

export function extractQuestions(messages: Message[]): string[] {
	const userMessages = messages.filter(m => m.role === 'user');
	const questions: string[] = [];

	for (const msg of userMessages) {
		const text = stripMarkdown(msg.plainText.trim());
		if (!text) continue;

		const rawSentence = extractFirstSentence(text);

		// Light stripping: only filler prefixes (skip action verb patterns)
		// to preserve readable question phrasing
		let sentence = rawSentence;
		let changed = true;
		while (changed) {
			changed = false;
			for (const pattern of FILLER_PREFIXES) {
				const stripped = sentence.replace(pattern, '');
				if (stripped !== sentence) {
					sentence = stripped.trim().replace(/^[,;:.!?\-]+\s*/, '');
					changed = true;
				}
			}
		}

		// If light stripping reduced too aggressively, fall back to cleaned original
		if (sentence.length < 20) {
			const fallback = cleanMarkdownInline(rawSentence).trim();
			if (fallback.length >= 20) {
				sentence = fallback;
			}
		}

		sentence = stripLeadingArtifacts(sentence);
		sentence = sentence.replace(/^[,;:.!?\-]+\s*/, '').trim();

		if (sentence.length < 5) continue;

		const cleaned = cleanMarkdownInline(sentence);
		if (cleaned.length < 5) continue;

		// B5: Only include actual questions, not statements
		if (!isLikelyQuestion(cleaned)) continue;

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
			text = stripLeadingArtifacts(text);
			// Strip numbering prefixes
			text = text.replace(/^(\d+\.\s*|step\s+\d+[:.]\s*|part\s+[a-z0-9]+[:.]\s*)/i, '').trim();

			if (text.length < 3) continue;
			// B6: Reject short fragments and conversational noise
			if (text.length < 20 && isConversationalFragment(text)) continue;

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
			sentence = stripLeadingArtifacts(sentence);

			// Filter out conversational sentences (not useful as topic labels)
			if (/\b(you|your|you're|you'll|we|we're|i'm|i'll|i've)\b/i.test(sentence)) continue;

			// B6: Filter conversational acknowledgments and fragments
			if (isConversationalFragment(sentence)) continue;

			if (sentence.length < 10) continue;

			// Cap topic length at 80 chars with word-boundary truncation
			if (sentence.length > 80) {
				const lastSpace = sentence.lastIndexOf(' ', 80);
				sentence = lastSpace > 40 ? sentence.slice(0, lastSpace) : sentence.slice(0, 80);
			}

			if (!isDuplicate(sentence, topics)) {
				topics.push(sentence);
			}

			if (topics.length >= MAX_TOPICS) break;
		}
	}

	return topics;
}

function isAssistantPrompt(text: string): boolean {
	if (/\b(if you tell me|if you give me|if you let me|if you share|if you send)\b/i.test(text)) return true;
	if (/\b(if you want|if you'd like|if you prefer|if you need)\b/i.test(text)) return true;
	if (/\b(let me know|you can also|feel free to|just tell me|just let me know)\b/i.test(text)) return true;
	if (/\bif you\b/i.test(text)) return true;
	return false;
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

			// B7: Only match takeaway patterns in the first 60 chars
			// to avoid false positives from incidental word use deep in a sentence
			const prefix = sentence.slice(0, 60);
			const matchesPattern = TAKEAWAY_PATTERNS.some(p => p.test(prefix));
			if (!matchesPattern) continue;

			// Filter out user-directed prompts and assistant solicitations
			if (isAssistantPrompt(sentence)) continue;

			// B7: Filter conversational filler
			if (CONVERSATIONAL_ACK_PATTERN.test(sentence)) continue;

			// B7: Minimum informativeness -- must contain at least one
			// noun-like word (4+ chars, not all common verbs/adverbs)
			const words = sentence.split(/\s+/).filter(w => w.length >= 4);
			if (words.length < 3) continue;

			let cleaned = cleanMarkdownInline(sentence).trim();
			// Strip leading list markers that survived
			cleaned = cleaned.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '');
			// Strip embedded newlines before truncation
			cleaned = cleaned.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
			cleaned = stripLeadingArtifacts(cleaned);

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

				if (isAssistantPrompt(text)) continue;

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
				if (cleaned.length >= 15 && !isAssistantPrompt(cleaned)) {
					takeaways.push(truncateItem(cleaned));
				}
			}
		}
	}

	return takeaways;
}

// Common abbreviations that should not trigger sentence splits
const ABBREVIATIONS = /\b(?:St|Mr|Mrs|Ms|Dr|Jr|Sr|vs|etc|e\.g|i\.e|U\.S|U\.K|U\.S\.A|approx|govt|dept|assn|corp|inc|ltd|co|est|min|max|avg|no|vol|ch|pt|fig|ref)\.\s/gi;
// Placeholder that won't match sentence-end regex
const ABBREV_PLACEHOLDER = '\u0000ABBR\u0000 ';

function splitIntoSentences(text: string): string[] {
	// Strip code blocks first
	let stripped = text.replace(/```[\s\S]*?```/g, '');

	// Protect abbreviations from sentence splitting
	const abbrevMap: string[] = [];
	stripped = stripped.replace(ABBREVIATIONS, (match) => {
		abbrevMap.push(match);
		return ABBREV_PLACEHOLDER;
	});

	const sentences: string[] = [];

	// Split on sentence-ending punctuation followed by space or newline
	const parts = stripped.split(/(?<=[.!?])\s+/);
	for (const part of parts) {
		// Restore abbreviations
		let restored = part;
		while (restored.includes('\u0000ABBR\u0000') && abbrevMap.length > 0) {
			restored = restored.replace(ABBREV_PLACEHOLDER, abbrevMap.shift()!);
		}
		const trimmed = restored.trim();
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
