import type { Message } from './conversation';

export type Granularity = 'coarse' | 'medium' | 'fine';

export type SegmentationMethod = 'heuristic' | 'ollama' | 'manual';

export interface SignalResult {
	signal: string;
	score: number;
	weight: number;
	detail?: string;
}

export interface SegmentBoundary {
	beforeIndex: number;
	score: number;
	signals: SignalResult[];
}

export interface Segment {
	id: string;
	title: string;
	summary: string;
	tags: string[];
	messages: Message[];
	startIndex: number;
	endIndex: number;
	confidence: number;
	method: SegmentationMethod;
}

export interface GranularityThresholds {
	confidenceThreshold: number;
	minMessages: number;
	minWords: number;
}

export interface SegmentationConfig {
	granularity: Granularity;
	method: 'heuristic' | 'ollama';
	signalWeights: Record<string, number>;
	thresholds: GranularityThresholds;
}

export const GRANULARITY_PRESETS: Record<Granularity, GranularityThresholds> = {
	coarse: { confidenceThreshold: 0.55, minMessages: 8, minWords: 500 },
	medium: { confidenceThreshold: 0.40, minMessages: 4, minWords: 200 },
	fine:   { confidenceThreshold: 0.30, minMessages: 2, minWords: 80 },
};
