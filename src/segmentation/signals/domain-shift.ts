import type { Message } from '../../types';
import { tokenize, removeStopWords } from '../../utils/stop-words';

export function scoreDomainShift(
	messages: Message[],
	boundaryIndex: number,
	windowSize: number
): number {
	const beforeTokens = extractDomainTokens(messages, boundaryIndex - windowSize, boundaryIndex);
	const afterTokens = extractDomainTokens(messages, boundaryIndex, boundaryIndex + windowSize);

	if (beforeTokens.size < 5 || afterTokens.size < 5) return 0.0;

	const intersection = new Set([...beforeTokens].filter(t => afterTokens.has(t)));
	const union = new Set([...beforeTokens, ...afterTokens]);

	const jaccard = intersection.size / union.size;
	return 1.0 - jaccard;
}

function extractDomainTokens(messages: Message[], start: number, end: number): Set<string> {
	const tokens = new Set<string>();
	const clampedStart = Math.max(0, start);
	const clampedEnd = Math.min(messages.length, end);

	for (let i = clampedStart; i < clampedEnd; i++) {
		const words = removeStopWords(tokenize(messages[i].plainText));
		for (const word of words) {
			tokens.add(word);
		}
	}

	return tokens;
}
