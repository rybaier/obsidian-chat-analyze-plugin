import type { Message, SegmentationConfig, SegmentBoundary, SignalResult } from '../types';
import { scoreTransitionPhrases } from './signals/transition-phrases';
import { scoreDomainShift } from './signals/domain-shift';
import { scoreVocabularyShift } from './signals/vocabulary-shift';
import { scoreTemporalGap } from './signals/temporal-gap';
import { scoreSelfContained } from './signals/self-contained';
import { scoreReintroduction } from './signals/reintroduction';

const WINDOW_SIZE = 4;

export function scoreBoundaries(
	messages: Message[],
	config: SegmentationConfig
): SegmentBoundary[] {
	const boundaries: SegmentBoundary[] = [];
	const weights = config.signalWeights;

	for (let i = 1; i < messages.length; i++) {
		if (messages[i].role !== 'user') continue;

		const signals: SignalResult[] = [];

		const transitionScore = scoreTransitionPhrases(messages[i]);
		signals.push({
			signal: 'transition-phrases',
			score: transitionScore,
			weight: weights['transition-phrases'] || 0,
		});

		const domainScore = scoreDomainShift(messages, i, WINDOW_SIZE);
		signals.push({
			signal: 'domain-shift',
			score: domainScore,
			weight: weights['domain-shift'] || 0,
		});

		const vocabScore = scoreVocabularyShift(messages, i, WINDOW_SIZE);
		signals.push({
			signal: 'vocabulary-shift',
			score: vocabScore,
			weight: weights['vocabulary-shift'] || 0,
		});

		const prevMessage = messages[i - 1];
		const temporalScore = scoreTemporalGap(prevMessage, messages[i]);
		signals.push({
			signal: 'temporal-gap',
			score: temporalScore,
			weight: weights['temporal-gap'] || 0,
		});

		let selfContainedScore = 0;
		if (prevMessage.role === 'assistant') {
			selfContainedScore = scoreSelfContained(prevMessage, messages[i]);
		}
		signals.push({
			signal: 'self-contained',
			score: selfContainedScore,
			weight: weights['self-contained'] || 0,
		});

		const reintroScore = scoreReintroduction(messages[i]);
		signals.push({
			signal: 'reintroduction',
			score: reintroScore,
			weight: weights['reintroduction'] || 0,
		});

		const compositeScore = signals.reduce(
			(sum, s) => sum + s.score * s.weight,
			0
		);

		boundaries.push({
			beforeIndex: i,
			score: compositeScore,
			signals,
		});
	}

	return boundaries;
}
