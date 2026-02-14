import type { Message } from '../../types';

const STRONG_PATTERNS = [
	/^(i have a question|can you help|i need help|could you explain|what('?s| is| are))\b/i,
];

const MODERATE_PATTERNS = [
	/^(how (do|can|should)|why (do|does|is)|is (it|there)|tell me about)\b/i,
];

export function scoreReintroduction(message: Message): number {
	if (message.role !== 'user') return 0.0;

	const text = message.plainText.trim();

	for (const pattern of STRONG_PATTERNS) {
		if (pattern.test(text)) return 1.0;
	}

	for (const pattern of MODERATE_PATTERNS) {
		if (pattern.test(text)) return 0.5;
	}

	return 0.0;
}
