import type { InputFormat } from './parser-interface';
import { maskCodeBlocks } from './code-block-guard';

export function detectFormat(input: string): InputFormat {
	const trimmed = input.trim();

	if (isJson(trimmed)) {
		return detectJsonFormat(trimmed);
	}

	if (isChatGPTPaste(trimmed)) {
		return { source: 'chatgpt', method: 'paste' };
	}

	if (isClaudePaste(trimmed)) {
		return { source: 'claude', method: 'paste' };
	}

	if (isClaudeWebPaste(trimmed)) {
		return { source: 'claude', method: 'paste' };
	}

	if (isLikelyChatGPTPaste(trimmed)) {
		return { source: 'chatgpt', method: 'paste' };
	}

	return { source: 'markdown', method: 'paste' };
}

function isJson(input: string): boolean {
	return (input.startsWith('{') || input.startsWith('['));
}

function detectJsonFormat(input: string): InputFormat {
	try {
		const parsed = JSON.parse(input);

		if (Array.isArray(parsed)) {
			if (parsed.length > 0 && parsed[0].mapping) {
				return { source: 'chatgpt', method: 'file-json' };
			}
			if (parsed.length > 0 && parsed[0].chat_messages) {
				return { source: 'claude', method: 'file-json' };
			}
		}

		if (parsed.mapping && typeof parsed.mapping === 'object') {
			return { source: 'chatgpt', method: 'file-json' };
		}

		if (parsed.chat_messages && Array.isArray(parsed.chat_messages)) {
			return { source: 'claude', method: 'file-json' };
		}
	} catch {
		// Not valid JSON, fall through to paste detection
	}

	return { source: 'markdown', method: 'paste' };
}

function isChatGPTPaste(input: string): boolean {
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

function isClaudePaste(input: string): boolean {
	const lines = input.split('\n');
	let hasHuman = false;
	let hasAssistant = false;
	for (const line of lines) {
		const trimmed = line.trim();
		if (/^Human\s*:/i.test(trimmed)) hasHuman = true;
		if (/^(Assistant|Claude)\s*:/i.test(trimmed)) hasAssistant = true;
		if (hasHuman && hasAssistant) return true;
	}
	return false;
}

/**
 * Detect ChatGPT conversations pasted without speaker labels by looking for
 * structural patterns typical of ChatGPT output: high heading density,
 * bold label lines, numbered bold items, and AI disclaimers.
 *
 * ChatGPT responses are heavily structured (lists, headings, bold labels)
 * so plain-paragraph counting doesn't work -- most lines start with
 * structural markers like -, *, digits, or #.
 */
export function isLikelyChatGPTPaste(input: string): boolean {
	const { masked } = maskCodeBlocks(input);
	const lines = masked.split('\n');

	// Yield to Claude web detection: if the content has date stamps that
	// match Claude web format, it's not an unlabeled ChatGPT paste
	const datePattern =
		/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}$/;
	let dateStampCount = 0;
	for (const line of lines) {
		if (datePattern.test(line.trim())) dateStampCount++;
	}
	if (dateStampCount >= 2) return false;

	let score = 0;

	// Pattern 1: High heading density (h1-h4). ChatGPT uses many headings
	// to organize long responses across multiple topics.
	let headingCount = 0;
	for (const line of lines) {
		if (/^#{1,4}\s+.+/.test(line.trim())) headingCount++;
	}
	if (headingCount >= 8) score += 2;
	else if (headingCount >= 4) score++;

	// Pattern 2: Bold label lines -- standalone **Topic** or **Label:**
	// ChatGPT uses these as pseudo-headings and list item labels.
	// Allow trailing colon/punctuation outside the bold markers.
	let boldLabelCount = 0;
	for (const line of lines) {
		const trimmed = line.trim();
		if (/^\*\*[^*]{3,60}\*\*[:\s]*$/.test(trimmed)) boldLabelCount++;
	}
	if (boldLabelCount >= 3) score++;

	// Pattern 3: Numbered items with bold (1. **Item** -- ...)
	let numberedBoldCount = 0;
	for (const line of lines) {
		if (/^\d+\.\s+\*\*/.test(line.trim())) numberedBoldCount++;
	}
	if (numberedBoldCount >= 3) score++;

	// Pattern 4: AI disclaimer text
	const disclaimerPattern = /\b(as an AI|as of my (knowledge|last) (cutoff|update|training)|I('m| am) an AI|not (a )?(licensed|certified|qualified)|I can't provide (medical|legal|financial))\b/i;
	if (disclaimerPattern.test(input)) score++;

	// Pattern 5: Large document with heading structure -- ChatGPT conversations
	// produce long, multi-topic output. A short doc with headings is just markdown.
	const totalWords = masked.split(/\s+/).length;
	if (totalWords >= 800 && headingCount >= 4) score++;

	// Require at least 3 to trigger
	return score >= 3;
}

function isClaudeWebPaste(input: string): boolean {
	if (/^(Human|Assistant|Claude)\s*:/im.test(input)) {
		return false;
	}

	const { masked } = maskCodeBlocks(input);
	const lines = masked.split('\n');
	const datePattern =
		/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}$/;
	let dateCount = 0;

	for (const line of lines) {
		if (datePattern.test(line.trim())) {
			dateCount++;
			if (dateCount >= 2) return true;
		}
	}

	return false;
}
