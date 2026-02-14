import type { ParsedConversation, Segment, SegmentationConfig, Message } from '../../types';
import { generateTags } from '../tag-generator';
import { OllamaClient } from './client';
import { chunkConversation } from './chunker';
import { buildSegmentationPrompt } from './prompts';

function generateId(): string {
	return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
}

interface LLMSegmentResult {
	startIndex: number;
	endIndex: number;
	title: string;
	summary: string;
	confidence: number;
}

export async function segmentWithOllama(
	conversation: ParsedConversation,
	config: SegmentationConfig,
	endpoint: string,
	model: string,
	tagPrefix: string = 'ai-chat'
): Promise<Segment[]> {
	const client = new OllamaClient(endpoint);

	const healthy = await client.healthCheck();
	if (!healthy) {
		throw new Error('Ollama is not reachable');
	}

	const messages = conversation.messages;
	const chunks = chunkConversation(messages);
	const allResults: LLMSegmentResult[] = [];

	for (const chunk of chunks) {
		const prompt = buildSegmentationPrompt(chunk.messages, config.granularity);
		const response = await client.generate(prompt, model);
		const parsed = parseResponse(response);
		allResults.push(...parsed);
	}

	const merged = deduplicateResults(allResults, messages);
	validateResults(merged, messages);

	return buildSegments(merged, messages, tagPrefix);
}

function parseResponse(response: string): LLMSegmentResult[] {
	const trimmed = response.trim();
	const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
	if (!jsonMatch) {
		throw new Error('Ollama response did not contain a JSON array');
	}

	const parsed = JSON.parse(jsonMatch[0]);
	if (!Array.isArray(parsed)) {
		throw new Error('Ollama response is not a JSON array');
	}

	return parsed.map((item: Record<string, unknown>) => ({
		startIndex: item.startIndex as number,
		endIndex: item.endIndex as number,
		title: (item.title as string) || 'Untitled',
		summary: (item.summary as string) || '',
		confidence: typeof item.confidence === 'number' ? item.confidence : 0.5,
	}));
}

function deduplicateResults(results: LLMSegmentResult[], messages: Message[]): LLMSegmentResult[] {
	if (results.length === 0) return results;

	const maxIndex = messages[messages.length - 1].index;
	const seen = new Set<number>();
	const unique: LLMSegmentResult[] = [];

	results.sort((a, b) => a.startIndex - b.startIndex);

	for (const result of results) {
		if (result.startIndex > maxIndex || result.endIndex > maxIndex) continue;
		if (result.startIndex < 0 || result.endIndex < 0) continue;

		if (!seen.has(result.startIndex)) {
			seen.add(result.startIndex);
			unique.push(result);
		}
	}

	return unique;
}

function validateResults(results: LLMSegmentResult[], messages: Message[]): void {
	if (results.length === 0) {
		throw new Error('Ollama returned no valid segments');
	}

	const indexSet = new Set(messages.map(m => m.index));

	for (const result of results) {
		if (!indexSet.has(result.startIndex)) {
			throw new Error(`Invalid startIndex ${result.startIndex} from Ollama`);
		}
		if (!indexSet.has(result.endIndex)) {
			throw new Error(`Invalid endIndex ${result.endIndex} from Ollama`);
		}
		if (result.startIndex > result.endIndex) {
			throw new Error(`startIndex ${result.startIndex} > endIndex ${result.endIndex}`);
		}
	}
}

function buildSegments(
	results: LLMSegmentResult[],
	messages: Message[],
	tagPrefix: string
): Segment[] {
	const indexToPos = new Map<number, number>();
	messages.forEach((m, i) => indexToPos.set(m.index, i));

	return results.map(result => {
		const startPos = indexToPos.get(result.startIndex) ?? 0;
		const endPos = indexToPos.get(result.endIndex) ?? messages.length - 1;
		const segMessages = messages.slice(startPos, endPos + 1);

		return {
			id: generateId(),
			title: result.title.slice(0, 50),
			summary: result.summary,
			tags: generateTags(segMessages, tagPrefix),
			messages: segMessages,
			startIndex: result.startIndex,
			endIndex: result.endIndex,
			confidence: result.confidence,
			method: 'ollama' as const,
		};
	});
}
