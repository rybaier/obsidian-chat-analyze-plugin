import type { Message } from '../../types';
import { tokenize, removeStopWords } from '../../utils/stop-words';

export function scoreVocabularyShift(
	messages: Message[],
	boundaryIndex: number,
	windowSize: number
): number {
	const beforeTf = buildTfVector(messages, boundaryIndex - windowSize, boundaryIndex);
	const afterTf = buildTfVector(messages, boundaryIndex, boundaryIndex + windowSize);

	if (beforeTf.size === 0 || afterTf.size === 0) return 0.0;

	const similarity = cosineSimilarity(beforeTf, afterTf);
	return 1.0 - similarity;
}

function buildTfVector(messages: Message[], start: number, end: number): Map<string, number> {
	const tf = new Map<string, number>();
	const clampedStart = Math.max(0, start);
	const clampedEnd = Math.min(messages.length, end);

	for (let i = clampedStart; i < clampedEnd; i++) {
		const words = removeStopWords(tokenize(messages[i].plainText));
		for (const word of words) {
			tf.set(word, (tf.get(word) || 0) + 1);
		}
	}

	return tf;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
	let dotProduct = 0;
	let normA = 0;
	let normB = 0;

	for (const [term, count] of a) {
		normA += count * count;
		const bCount = b.get(term);
		if (bCount !== undefined) {
			dotProduct += count * bCount;
		}
	}

	for (const [, count] of b) {
		normB += count * count;
	}

	const denominator = Math.sqrt(normA) * Math.sqrt(normB);
	if (denominator === 0) return 0;

	return dotProduct / denominator;
}
