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
 * structural patterns: alternating short/long sections, bold-only lines,
 * numbered lists, and AI disclaimer text.
 */
export function isLikelyChatGPTPaste(input: string): boolean {
	const { masked } = maskCodeBlocks(input);
	const lines = masked.split('\n');

	let score = 0;

	// Pattern 1: Multiple ## or ### headings interspersed with plain paragraphs
	let headingCount = 0;
	let plainParaCount = 0;
	for (const line of lines) {
		const trimmed = line.trim();
		if (/^#{2,3}\s+.+/.test(trimmed)) headingCount++;
		else if (trimmed.length > 30 && !/^[-*+#>\d]/.test(trimmed)) plainParaCount++;
	}
	if (headingCount >= 4 && plainParaCount >= 4) score += 2;

	// Pattern 2: Bold-only lines (ChatGPT uses **Topic** as pseudo-headings)
	let boldLineCount = 0;
	for (const line of lines) {
		if (/^\s*\*\*[^*]{3,60}\*\*\s*$/.test(line)) boldLineCount++;
	}
	if (boldLineCount >= 3) score++;

	// Pattern 3: Numbered recommendation lists (1. **Item** -- ...)
	let numberedBoldCount = 0;
	for (const line of lines) {
		if (/^\d+\.\s+\*\*/.test(line.trim())) numberedBoldCount++;
	}
	if (numberedBoldCount >= 3) score++;

	// Pattern 4: AI disclaimer text
	const disclaimerPattern = /\b(as an AI|as of my (knowledge|last) (cutoff|update|training)|I('m| am) an AI|not (a )?(licensed|certified|qualified)|I can't provide (medical|legal|financial))\b/i;
	if (disclaimerPattern.test(input)) score++;

	// Pattern 5: Question-answer rhythm -- short sections (<50 words) followed
	// by long sections (>100 words), split by headings or double newlines
	const sections = masked.split(/\n#{2,3}\s+|\n{3,}/);
	let shortThenLong = 0;
	for (let i = 0; i < sections.length - 1; i++) {
		const curWords = sections[i].trim().split(/\s+/).length;
		const nextWords = sections[i + 1].trim().split(/\s+/).length;
		if (curWords < 50 && nextWords > 100) shortThenLong++;
	}
	if (shortThenLong >= 3) score++;

	// Require at least 3 pattern matches to avoid false positives
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
