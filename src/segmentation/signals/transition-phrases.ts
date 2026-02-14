import type { Message } from '../../types';

const STRONG_PATTERNS = [
	/^(let'?s|can we|i want to)\s+(move on|switch|change|talk about|discuss)/i,
	/^(on a different|new)\s+(note|topic|subject)/i,
	/^(switching|changing|moving)\s+(to|on to)/i,
];

const MODERATE_PATTERNS = [
	/^(now|next|also|another)\b.*\?/i,
	/^(ok\s+)?(let'?s|can we|i want to)\s+(explore|create|look at|go|try|start|build|make|do|set up|work on)\b/i,
	/^(ok\s+)?(perfect|great|thanks?|thank you)[\s,.!]*(can you|could you|let'?s|now)\b/i,
	/^(ok\s+)?(perfect|great|thanks?|thank you)[\s,.!]+[\w\s,]*\b(can you|could you|help|let'?s)\b/i,
];

export function scoreTransitionPhrases(message: Message): number {
	if (message.role !== 'user') return 0.0;

	const text = message.plainText.slice(0, 200).trim();

	for (const pattern of STRONG_PATTERNS) {
		if (pattern.test(text)) return 1.0;
	}

	for (const pattern of MODERATE_PATTERNS) {
		if (pattern.test(text)) return 0.5;
	}

	return 0.0;
}
