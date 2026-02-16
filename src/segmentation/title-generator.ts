import type { Message } from '../types';
import { tokenize, removeStopWords, STOP_WORDS } from '../utils/stop-words';

const MAX_TITLE_LENGTH = 72;

// Words that commonly start sentences but are not proper nouns
const CAPITALIZED_EXCLUSIONS = new Set([
	'I', 'However', 'Therefore', 'Here', 'This', 'That', 'Also',
	'Yes', 'No', 'Ok', 'Sure', 'Well', 'But', 'And', 'Or', 'So',
	'If', 'When', 'Where', 'While', 'After', 'Before', 'Because',
	'Since', 'Although', 'Though', 'Unless', 'Until', 'Once',
	'Then', 'Now', 'Just', 'Even', 'Still', 'Already', 'Never',
	'Always', 'Maybe', 'Perhaps', 'Please', 'Thanks', 'Thank',
	'Actually', 'Basically', 'Certainly', 'Definitely', 'Finally',
	'Generally', 'Honestly', 'Hopefully', 'Instead', 'Meanwhile',
	'Obviously', 'Otherwise', 'Overall', 'Personally', 'Really',
	'Recently', 'Specifically', 'Unfortunately', 'Usually',
	'Great', 'Good', 'Nice', 'Right', 'Perfect', 'Awesome',
	'Let', 'Can', 'Could', 'Would', 'Should', 'Will', 'May',
	'Might', 'Must', 'Shall', 'Do', 'Does', 'Did', 'Have',
	'Has', 'Had', 'Are', 'Is', 'Was', 'Were', 'Be', 'Being',
	'Been', 'Some', 'Many', 'Most', 'Any', 'All', 'Each',
	'Every', 'Both', 'Several', 'Few', 'More', 'Other',
	'Another', 'First', 'Second', 'Third', 'Next', 'Last',
	'New', 'Old', 'Big', 'Small', 'Long', 'Short', 'High', 'Low',
	'There', 'These', 'Those', 'What', 'Which', 'Who', 'How',
	'Why', 'The', 'A', 'An', 'My', 'Your', 'His', 'Her', 'Its',
	'Our', 'Their', 'For', 'From', 'With', 'About', 'Into',
	'Through', 'During', 'Above', 'Below', 'Between', 'Under',
	'Again', 'Further', 'Not', 'Very', 'Too', 'Much', 'Such',
	'Only', 'Same', 'Other', 'No', 'Nor', 'Yet', 'Of', 'In',
	'On', 'At', 'To', 'By', 'Up', 'Out', 'Off', 'Over',
	// Common action verbs that start sentences in structured content
	'Arrive', 'Visit', 'Drive', 'Meet', 'Explore', 'Check', 'Book',
	'Call', 'Contact', 'Review', 'Schedule', 'Plan', 'Travel',
	'Return', 'Depart', 'Fly', 'Walk', 'Tour', 'Enjoy', 'Stay',
	'Start', 'Continue', 'Complete', 'Finish', 'Leave', 'Head',
	'Take', 'Make', 'Get', 'Set', 'Keep', 'Note', 'See', 'Look',
	'Try', 'Buy', 'Sell', 'Rent', 'Ask', 'Find', 'Pick', 'Choose',
	'Consider', 'Ensure', 'Include', 'Provide', 'Offer', 'Compare',
	'Focus', 'Spend', 'Cost', 'Need', 'Expect', 'Allow', 'Require',
	// Common nouns that look like entities at sentence starts
	'Healthcare', 'Insurance', 'Property', 'Budget', 'Price',
	'Safety', 'Security', 'Climate', 'Weather', 'Location',
	'Lifestyle', 'Quality', 'Access', 'Transport', 'Airport',
	'Flight', 'Hotel', 'Cost', 'Tax', 'Fee', 'Income',
	// Generic geographic/category terms
	'Island', 'Islands', 'Country', 'Countries', 'Region',
	'City', 'Town', 'Area', 'District', 'Zone', 'Province',
	'State', 'North', 'South', 'East', 'West', 'Central',
	'Coast', 'Beach', 'Bay', 'Harbour', 'Harbor', 'Port',
	'Mountain', 'Valley', 'Lake', 'River', 'Ocean', 'Sea',
	'Passport', 'Visa', 'Citizenship', 'Residency', 'Program',
	'Programs', 'Application', 'Process', 'Requirement',
]);

const FILLER_PREFIXES = [
	/^(can you|could you|please|would you|i want you to|help me|i need you to)[,;:.!?]?\s+/i,
	/^(ok so|ok perfect|ok great|ok|perfect|great|awesome|thanks|thank you|alright so|alright|yeah so|yeah|sure|got it|so)[,;:.!?]?\s+/i,
];

const ACTION_VERB_PATTERNS = [
	/^let'?s\s+(create|explore|break\s+down|look\s+at|discuss|research|compare|analyze|examine|review|check|find|build|make|write|design|plan|develop|figure\s+out|work\s+on|go\s+over|go\s+through|talk\s+about|think\s+about|dive\s+into|start\s+with|begin\s+with|focus\s+on|look\s+into)\s+/i,
	/^(do\s+some|do\s+a)\s+(research|analysis|comparison|breakdown|review|deep\s+dive|exploration|investigation)\s+(about|on|for|into|of|regarding)\s+/i,
	/^what\s+are\s+the\s+/i,
	/^what\s+is\s+the\s+/i,
	/^what\s+about\s+the\s+/i,
	/^what\s+about\s+/i,
	/^tell\s+me\s+about\s+/i,
	/^give\s+me\s+(a|an|the|some)\s+/i,
	/^show\s+me\s+(a|an|the|some)\s+/i,
	/^(help|help\s+me)\s+(do\s+some|with\s+some|with\s+the|with\s+a|with)\s+(research|analysis|comparison)\s+(about|on|for|into|of|regarding)\s+/i,
	/^(help|help\s+me)\s+(find|create|explore|research|analyze|compare|review|understand|learn\s+about)\s+/i,
	/^i\s+(want|need|would\s+like)\s+to\s+(know|learn|understand|find\s+out|research|explore|compare|look\s+at|see)\s+(about|more\s+about)?\s*/i,
	/^(explain|describe|outline|summarize|list)\s+(the|all|each|every)?\s*/i,
	// Standalone action verbs at start of kernel after other stripping
	/^(break\s+down|look\s+at|go\s+over|go\s+through|dive\s+into|look\s+into)\s+(the\s+|each\s+|every\s+|all\s+)?/i,
	/^(each\s+country|each\s+option|each\s+one)\s+(in|and|for|with)\s+/i,
	// "carriibbean countries that will give you..." type conversational continuations
	/\s+that\s+(will|would|can|could|might|should)\s+.+$/i,
	/\s+if\s+you\s+.+$/i,
];

const CONTEXTUAL_REFS = /\b(number\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)|option\s+[a-d]|#\d+)\b\s*/gi;

const COMPARISON_PATTERNS = [
	/\b(.+?)\s+vs\.?\s+(.+)/i,
	/\b(.+?)\s+versus\s+(.+)/i,
	/\bdifference(?:s)?\s+between\s+(.+?)\s+and\s+(.+)/i,
	/\bbenefits\s+of\s+(.+?)\s+and\s+(.+)/i,
	/\bcompare\s+(.+?)\s+(?:and|with|to)\s+(.+)/i,
	/\b(.+?)\s+(?:compared\s+to|compared\s+with)\s+(.+)/i,
	/\bpros\s+and\s+cons\s+of\s+(.+?)\s+(?:and|vs\.?|versus)\s+(.+)/i,
];

/**
 * Priority chain title generator. Returns the first non-null result:
 * 1. Comparison pattern ("X vs Y")
 * 2. Entity + topic kernel
 * 3. Cleaned first sentence (current approach, enhanced)
 * 4. Keyword fallback
 */
export function generateTitle(messages: Message[]): string {
	return tryComparisonTitle(messages)
		?? tryEntityTitle(messages)
		?? tryCleanedSentence(messages)
		?? generateFromKeywords(messages);
}

// --- Strategy 1: Comparison Detection ---

function tryComparisonTitle(messages: Message[]): string | null {
	const firstUser = messages.find(m => m.role === 'user');
	if (!firstUser) return null;

	// Strip filler and action verbs before matching comparison patterns
	let text = stripMarkdown(firstUser.plainText.trim());
	const firstLine = text.split('\n')[0];
	text = stripFillerAndActions(firstLine);

	for (const pattern of COMPARISON_PATTERNS) {
		const match = text.match(pattern);
		if (match) {
			const sideA = cleanComparisonSide(match[1]);
			const sideB = cleanComparisonSide(match[2]);
			if (sideA && sideB) {
				const title = toTitleCase(`${sideA} vs ${sideB}`);
				if (title.length <= MAX_TITLE_LENGTH) return title;
				return truncateAtWord(title, MAX_TITLE_LENGTH);
			}
		}
	}

	return null;
}

function stripFillerAndActions(text: string): string {
	let sentence = text;
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
		for (const pattern of ACTION_VERB_PATTERNS) {
			const stripped = sentence.replace(pattern, '');
			if (stripped !== sentence) {
				sentence = stripped.trim().replace(/^[,;:.!?\-]+\s*/, '');
				changed = true;
			}
		}
	}
	return sentence;
}

function cleanComparisonSide(text: string): string {
	let cleaned = text.trim();
	// Strip leading filler/question patterns
	cleaned = cleaned.replace(/^(what\s+about\s+(the\s+)?|how\s+about\s+(the\s+)?|tell\s+me\s+about\s+)/i, '').trim();
	// Remove trailing punctuation and filler
	cleaned = cleaned.replace(/[.!?,;:]+$/, '').trim();
	// Only strip trailing prepositional phrases if the side is long
	if (cleaned.length > 35) {
		cleaned = cleaned.replace(/\s+(in\s+the\s+.+|for\s+the\s+.+|of\s+the\s+.+)$/i, '').trim();
	}
	// Cap length of each side
	if (cleaned.length > 45) {
		cleaned = truncateAtWord(cleaned, 45);
	}
	return cleaned;
}

// --- Strategy 2: Entity + Topic Kernel ---

function tryEntityTitle(messages: Message[]): string | null {
	const entities = extractEntities(messages);
	if (entities.length === 0) return null;

	const firstUser = messages.find(m => m.role === 'user');
	let kernel = firstUser ? extractTopicKernel(firstUser.plainText) : '';

	// Remove entity names from kernel to prevent redundancy (fuzzy match for typos)
	if (kernel) {
		const kernelWords = kernel.split(/\s+/);
		const cleanedWords = kernelWords.filter(word => {
			const lower = word.replace(/[,;:.!?]+$/, '').toLowerCase();
			// Exact match dedup
			for (const entity of entities) {
				if (entity.toLowerCase() === lower) return false;
				// Fuzzy dedup: if word and entity share 80%+ of characters, treat as match
				// Handles typos like "carriibbean" vs "Caribbean"
				if (lower.length >= 4 && fuzzyMatch(lower, entity.toLowerCase())) return false;
			}
			return true;
		});
		kernel = cleanedWords.join(' ').replace(/^[,;:\s]+|[,;:\s]+$/g, '').trim();

		// Strip generic category words that add no value alongside entities
		kernel = kernel.replace(/\b(countries|country|options|things|ways|types|kinds|topics|items|details|aspects|features)\b/gi, '').trim();
		kernel = kernel.replace(/\s{2,}/g, ' ').trim();

		// Strip dangling verbs exposed by entity removal ("is", "are", "is one choice")
		kernel = kernel.replace(/^(is|are|was|were)\s+(one\s+choice|an?\s+|the\s+)?/i, '').trim();
		// Strip trailing dangling words ("primary airport is" -> "primary airport")
		let prevKernel = '';
		while (kernel !== prevKernel) {
			prevKernel = kernel;
			kernel = kernel.replace(/\s+(is|are|was|were|of|in|for|and|or|but|the|a|an|to|on|at|by|with|from|about)$/i, '').trim();
		}
		// Strip leading dangling prepositions (including if it's the entire kernel)
		kernel = kernel.replace(/^(in|of|for|on|at|by|with|from|about|to)(\s+|$)/i, '').trim();
		// Clean up leftover punctuation/whitespace
		kernel = kernel.replace(/^[,;:\s]+|[,;:\s]+$/g, '').trim();
		// If kernel is just a short noise word, drop it entirely
		if (kernel.length <= 3) kernel = '';
	}

	// Entities already have correct casing from raw text; only title-case the kernel
	const entityStr = entities.slice(0, 3).join(', ');
	const titleKernel = kernel ? toTitleCase(kernel) : '';

	let title: string;
	if (titleKernel.length > 0) {
		title = `${entityStr} ${titleKernel}`;
	} else {
		title = entityStr;
	}

	if (title.length <= MAX_TITLE_LENGTH) return title;
	return truncateAtWord(title, MAX_TITLE_LENGTH);
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Fuzzy match two lowercased strings. Returns true if they share enough
 * characters to be considered the same word (handles typos like doubled
 * letters or single-char substitutions).
 */
function fuzzyMatch(a: string, b: string): boolean {
	// Quick length check: if lengths differ by more than 30%, not a match
	if (Math.abs(a.length - b.length) > Math.max(a.length, b.length) * 0.3) {
		return false;
	}
	// Check if one starts with enough of the other (handles "carriibbean" vs "caribbean")
	const shorter = a.length <= b.length ? a : b;
	const longer = a.length <= b.length ? b : a;

	// Normalize by collapsing consecutive duplicate chars ("carriibbean" -> "caribean")
	const normA = a.replace(/(.)\1+/g, '$1');
	const normB = b.replace(/(.)\1+/g, '$1');
	if (normA === normB) return true;

	// Check if the first 5+ chars match (prefix match)
	const prefixLen = Math.min(5, shorter.length);
	if (shorter.slice(0, prefixLen) === longer.slice(0, prefixLen)) {
		// Count matching characters
		let matches = 0;
		const longerChars = longer.split('');
		for (const char of shorter) {
			const idx = longerChars.indexOf(char);
			if (idx !== -1) {
				matches++;
				longerChars.splice(idx, 1);
			}
		}
		return matches >= shorter.length * 0.75;
	}

	return false;
}

function extractEntities(messages: Message[]): string[] {
	const entityCounts = new Map<string, number>();

	for (const msg of messages) {
		const text = normalizeAbbreviations(stripMarkdown(msg.plainText));
		const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 0);
		// User messages get 3x weight so query topics outrank assistant content
		const weight = msg.role === 'user' ? 3 : 1;

		for (const sentence of sentences) {
			const words = sentence.trim().split(/\s+/);
			if (words.length === 0) continue;

			let i = 0;
			// Skip first word of sentence (always capitalized)
			if (words.length > 1) i = 1;

			while (i < words.length) {
				const word = words[i];
				const cleaned = word.replace(/[^a-zA-Z'-]/g, '');

				// Skip empty or single-character fragments
				if (!cleaned || cleaned.length < 2) {
					i++;
					continue;
				}

				// Check for ALL-CAPS acronyms (2+ alpha chars)
				if (/^[A-Z]{2,}$/.test(cleaned)) {
					const key = cleaned;
					entityCounts.set(key, (entityCounts.get(key) || 0) + weight);
					i++;
					continue;
				}

				// Check for capitalized word that isn't in exclusion set
				if (/^[A-Z]/.test(cleaned) && !CAPITALIZED_EXCLUSIONS.has(cleaned)) {
					// Merge consecutive capitalized words into multi-word entity
					// Stop merging at list separators (commas, semicolons) to keep
					// "Antigua, Barbados, Cayman" as three separate entities
					const entityParts = [cleaned];
					const hasTrailingListSep = /[,;]/.test(word);

					if (!hasTrailingListSep) {
						let j = i + 1;
						while (j < words.length) {
							const rawNext = words[j];
							const nextCleaned = rawNext.replace(/[^a-zA-Z'-]/g, '');
							if (nextCleaned && nextCleaned.length >= 2
								&& /^[A-Z]/.test(nextCleaned)
								&& !CAPITALIZED_EXCLUSIONS.has(nextCleaned)) {
								entityParts.push(nextCleaned);
								j++;
								// Stop if this word ends a list item
								if (/[,;]/.test(rawNext)) break;
							} else {
								break;
							}
						}
					}

					const entity = entityParts.join(' ');
					// Only count if entity isn't a common stop word when lowercased
					if (!STOP_WORDS.has(entity.toLowerCase())) {
						entityCounts.set(entity, (entityCounts.get(entity) || 0) + weight);
					}
					i += entityParts.length;
					continue;
				}

				i++;
			}
		}
	}

	if (entityCounts.size === 0) return [];

	// Rank by frequency, take top 5
	const sorted = [...entityCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([entity]) => entity);

	return sorted;
}

function extractTopicKernel(text: string): string {
	let sentence = extractFirstSentence(text);

	// Combined stripping loop: filler, action verbs, contextual refs, and misc patterns
	// Loop until nothing changes so that removing one pattern can expose another
	let changed = true;
	while (changed) {
		changed = false;
		const prev = sentence;

		// Filler prefixes
		for (const pattern of FILLER_PREFIXES) {
			sentence = sentence.replace(pattern, '').trim();
		}

		// Action verb patterns
		for (const pattern of ACTION_VERB_PATTERNS) {
			sentence = sentence.replace(pattern, '').trim();
		}

		// Contextual refs (number one, option a, #1)
		sentence = sentence.replace(CONTEXTUAL_REFS, '').trim();

		// Leading standalone numbers ("3, ") but not "1-week"
		sentence = sentence.replace(/^\d+[,;:]\s*/g, '').trim();

		// "one for each/every" anywhere
		sentence = sentence.replace(/,?\s*one\s+for\s+(each|every)\s*/gi, ' ').trim();

		// Clean up leftover leading punctuation
		sentence = sentence.replace(/^[,;:.!?\-]+\s*/, '').trim();

		if (sentence !== prev) changed = true;
	}

	// Strip leading articles and possessives
	sentence = sentence.replace(/^(the|a|an|our|my|your)\s+/i, '').trim();

	if (sentence.length > 0 && sentence.length <= 40) {
		return sentence;
	}

	if (sentence.length > 40) {
		return truncateAtWord(sentence, 40);
	}

	return '';
}

// --- Strategy 3: Cleaned First Sentence ---

function tryCleanedSentence(messages: Message[]): string | null {
	const firstUser = messages.find(m => m.role === 'user');
	if (!firstUser) return null;

	const text = firstUser.plainText.trim();
	let sentence = extractFirstSentence(text);

	// Iteratively strip filler prefixes
	let changed = true;
	while (changed) {
		changed = false;
		for (const pattern of FILLER_PREFIXES) {
			const stripped = sentence.replace(pattern, '');
			if (stripped !== sentence) {
				sentence = stripped.trim();
				sentence = sentence.replace(/^[,;:.!?\-]+\s*/, '');
				changed = true;
			}
		}
	}

	// Strip action verb patterns
	changed = true;
	while (changed) {
		changed = false;
		for (const pattern of ACTION_VERB_PATTERNS) {
			const stripped = sentence.replace(pattern, '');
			if (stripped !== sentence) {
				sentence = stripped.trim();
				sentence = sentence.replace(/^[,;:.!?\-]+\s*/, '');
				changed = true;
			}
		}
	}

	// Strip contextual references
	sentence = sentence.replace(CONTEXTUAL_REFS, '').trim();

	if (sentence.length === 0) return null;

	const titled = toTitleCase(sentence);
	if (titled.length <= MAX_TITLE_LENGTH) return titled;
	return truncateAtWord(titled, MAX_TITLE_LENGTH);
}

// --- Strategy 4: Keyword Fallback ---

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

// --- Shared Utilities ---

function stripMarkdown(text: string): string {
	return text
		.replace(/```[\s\S]*?```/g, '')       // code blocks
		.replace(/`[^`]+`/g, '')               // inline code
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links -> text
		.replace(/[*_~]+/g, '')                // bold/italic/strikethrough
		.replace(/^#{1,6}\s+/gm, '')           // heading markers
		.replace(/^>\s+/gm, '')                // blockquotes
		.replace(/^[-*+]\s+/gm, '')            // unordered list markers
		.replace(/^\d+\.\s+/gm, '');           // ordered list markers
}

function extractFirstSentence(text: string): string {
	const firstLine = text.split('\n')[0];
	const sentenceMatch = firstLine.match(/^[^.!?]*[.!?]/);
	if (sentenceMatch) {
		const extracted = sentenceMatch[0].replace(/[.!?]$/, '').trim();
		if (extracted.length < 15) {
			return firstLine.slice(0, 120).trim();
		}
		return extracted;
	}
	return firstLine.slice(0, 120).trim();
}

function truncateAtWord(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	const truncated = text.slice(0, maxLength);

	const phraseBoundary = truncated.match(/^(.+)[,;:](?:\s|$)/);
	if (phraseBoundary && phraseBoundary[1].length > maxLength * 0.4) {
		return phraseBoundary[1].trim();
	}

	const conjunctionBreak = truncated.match(/^(.+)\s+(?:and|or|but)\s+/i);
	if (conjunctionBreak && conjunctionBreak[1].length > maxLength * 0.4) {
		return conjunctionBreak[1].trim();
	}

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

function normalizeAbbreviations(text: string): string {
	// Convert "U.S." / "U.S.A." / "U.K." style abbreviations to solid form
	return text.replace(/\b([A-Z])\.([A-Z])\.(?:([A-Z])\.)?/g, (_match, a, b, c) => {
		return c ? `${a}${b}${c}` : `${a}${b}`;
	});
}

function toTitleCase(str: string): string {
	return str
		.split(/\s+/)
		.map((word, i) => {
			// Strip trailing punctuation to check the core word
			const punctMatch = word.match(/^([a-zA-Z'-]+)([^a-zA-Z'-]*)$/);
			if (punctMatch) {
				const core = punctMatch[1];
				const trailing = punctMatch[2];
				// Preserve ALL-CAPS acronyms (2+ letters)
				if (core === core.toUpperCase() && core.length >= 2 && /^[A-Z]+$/.test(core)) {
					return core + trailing;
				}
				const lower = core.toLowerCase();
				if (i === 0 || !MINOR_WORDS.has(lower)) {
					return lower.charAt(0).toUpperCase() + lower.slice(1) + trailing;
				}
				return lower + trailing;
			}
			// Fallback for words that are all punctuation or unusual
			return word;
		})
		.join(' ');
}
