import type { ParsedConversation, Segment, SegmentationConfig, Message } from '../types';
import { scoreBoundaries } from './scorer';
import { generateTitle } from './title-generator';
import { generateTags } from './tag-generator';
import { segmentWithOllama } from './ollama/ollama-segmenter';

function generateId(): string {
	return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
}

export const DEFAULT_SIGNAL_WEIGHTS: Record<string, number> = {
	'transition-phrases': 0.25,
	'domain-shift': 0.20,
	'vocabulary-shift': 0.20,
	'reintroduction': 0.15,
	'temporal-gap': 0.10,
	'self-contained': 0.10,
};

export const DOCUMENT_SIGNAL_WEIGHTS: Record<string, number> = {
	'transition-phrases': 0.00,
	'domain-shift': 0.50,
	'vocabulary-shift': 0.50,
	'reintroduction': 0.00,
	'temporal-gap': 0.00,
	'self-contained': 0.00,
};

export function segment(
	conversation: ParsedConversation,
	config: SegmentationConfig,
	tagPrefix: string = 'ai-chat'
): Segment[] {
	if (conversation.contentType === 'document') {
		config = { ...config, signalWeights: DOCUMENT_SIGNAL_WEIGHTS };
	}

	const messages = conversation.messages;

	if (messages.length < 2) {
		return [buildSegment(messages, 0, messages.length - 1, 1.0, tagPrefix)];
	}

	const hasUserMessages = messages.some(m => m.role === 'user');
	if (!hasUserMessages) {
		return [buildSegment(messages, 0, messages.length - 1, 1.0, tagPrefix)];
	}

	const boundaries = scoreBoundaries(messages, config);

	const sorted = [...boundaries]
		.filter(b => b.score >= config.thresholds.confidenceThreshold)
		.sort((a, b) => b.score - a.score);

	const acceptedIndices: number[] = [];

	for (const boundary of sorted) {
		const testIndices = [...acceptedIndices, boundary.beforeIndex].sort((a, b) => a - b);

		if (allSegmentsMeetMinimum(messages, testIndices, config)) {
			acceptedIndices.push(boundary.beforeIndex);
			acceptedIndices.sort((a, b) => a - b);
		}
	}

	if (acceptedIndices.length === 0) {
		return [buildSegment(messages, 0, messages.length - 1, 1.0, tagPrefix)];
	}

	const segments: Segment[] = [];
	const boundaryMap = new Map(boundaries.map(b => [b.beforeIndex, b.score]));

	let segStart = 0;
	for (let i = 0; i < acceptedIndices.length; i++) {
		const segEnd = acceptedIndices[i] - 1;
		const segMessages = messages.slice(segStart, acceptedIndices[i]);
		const confidence = segStart === 0 ? 1.0 : (boundaryMap.get(segStart) || 1.0);

		segments.push(buildSegment(segMessages, segStart, segEnd, confidence, tagPrefix));
		segStart = acceptedIndices[i];
	}

	const lastMessages = messages.slice(segStart);
	const lastConfidence = boundaryMap.get(segStart) || 1.0;
	segments.push(buildSegment(lastMessages, segStart, messages.length - 1, lastConfidence, tagPrefix));

	return segments;
}

function buildSegment(
	messages: Message[],
	startIndex: number,
	endIndex: number,
	confidence: number,
	tagPrefix: string
): Segment {
	return {
		id: generateId(),
		title: generateTitle(messages),
		summary: generateSummary(messages),
		tags: generateTags(messages, tagPrefix),
		messages,
		startIndex,
		endIndex: Math.max(startIndex, endIndex),
		confidence,
		method: 'heuristic',
	};
}

function generateSummary(messages: Message[]): string {
	const firstUser = messages.find(m => m.role === 'user');
	const firstAssistant = messages.find(m => m.role === 'assistant');

	const parts: string[] = [];

	if (firstUser) {
		const question = firstUser.plainText.split('\n')[0].slice(0, 100).trim();
		parts.push(question);
	}

	if (firstAssistant) {
		const text = firstAssistant.plainText
			// Strip full URLs (http/https)
			.replace(/(https?:)?\/\/\S+/g, '')
			// Strip protocol-less URLs like ://domain.com
			.replace(/:\/\/\S+/g, '')
			// Strip bare domain URLs like example.com/path
			.replace(/\b\w+\.(com|org|net|io|co|gov|edu)\b\S*/gi, '')
			.trim();
		const lines = text.split('\n')
			.map(l => l.replace(/^[\s:*\->#\u2014\u2013]+/, '').trim())
			.filter(l => l.length >= 10)
			// Skip markdown-syntax-only lines (headings, dividers, list markers)
			.filter(l => !/^#{1,6}\s*$/.test(l) && !/^-{3,}$/.test(l));
		const firstLine = lines[0] || '';
		const sentenceMatch = firstLine.match(/^[^.!?]*[.!?]/);
		const response = sentenceMatch
			? sentenceMatch[0].trim()
			: firstLine.slice(0, 100).trim();
		if (response && response.length > 5) {
			parts.push(response);
		}
	}

	return parts.join(' -- ') || 'No summary available.';
}

export interface OllamaSettings {
	endpoint: string;
	model: string;
}

export async function segmentWithFallback(
	conversation: ParsedConversation,
	config: SegmentationConfig,
	tagPrefix: string = 'ai-chat',
	ollamaSettings?: OllamaSettings
): Promise<{ segments: Segment[]; usedFallback: boolean }> {
	if (ollamaSettings) {
		try {
			const segments = await segmentWithOllama(
				conversation,
				config,
				ollamaSettings.endpoint,
				ollamaSettings.model,
				tagPrefix
			);
			return { segments, usedFallback: false };
		} catch (err) {
			console.log(
				`[Chat Splitter] Ollama segmentation failed, falling back to heuristic: ${err instanceof Error ? err.message : String(err)}`
			);
		}
	}

	return {
		segments: segment(conversation, config, tagPrefix),
		usedFallback: true,
	};
}

function allSegmentsMeetMinimum(
	messages: Message[],
	boundaryIndices: number[],
	config: SegmentationConfig
): boolean {
	const { minMessages, minWords } = config.thresholds;
	const starts = [0, ...boundaryIndices];
	const ends = [...boundaryIndices, messages.length];

	for (let i = 0; i < starts.length; i++) {
		const segMessages = messages.slice(starts[i], ends[i]);

		if (segMessages.length < minMessages) return false;

		const wordCount = segMessages.reduce(
			(sum, m) => sum + m.plainText.split(/\s+/).length,
			0
		);
		if (wordCount < minWords) return false;
	}

	return true;
}
