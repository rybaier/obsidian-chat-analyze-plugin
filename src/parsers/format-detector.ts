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
