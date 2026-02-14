import type { Segment, Message } from '../types';
import { generateTitle } from './title-generator';
import { generateTags } from './tag-generator';

function generateId(): string {
	return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
}

export function mergeSegments(
	segments: Segment[],
	idA: string,
	idB: string
): Segment[] {
	const indexA = segments.findIndex(s => s.id === idA);
	const indexB = segments.findIndex(s => s.id === idB);

	if (indexA === -1 || indexB === -1) return segments;
	if (Math.abs(indexA - indexB) !== 1) return segments;

	const first = segments[Math.min(indexA, indexB)];
	const second = segments[Math.max(indexA, indexB)];

	const mergedMessages = [...first.messages, ...second.messages];
	const tagPrefix = extractTagPrefix(first.tags);

	const merged: Segment = {
		id: generateId(),
		title: first.title,
		summary: first.summary,
		tags: generateTags(mergedMessages, tagPrefix),
		messages: mergedMessages,
		startIndex: first.startIndex,
		endIndex: second.endIndex,
		confidence: first.confidence,
		method: 'manual',
	};

	const result = [...segments];
	const minIdx = Math.min(indexA, indexB);
	result.splice(minIdx, 2, merged);

	return result;
}

export function splitSegment(
	segments: Segment[],
	segmentId: string,
	atMessageIndex: number
): Segment[] {
	const idx = segments.findIndex(s => s.id === segmentId);
	if (idx === -1) return segments;

	const seg = segments[idx];
	const localIndex = atMessageIndex - seg.startIndex;

	if (localIndex <= 0 || localIndex >= seg.messages.length) return segments;

	const firstMessages = seg.messages.slice(0, localIndex);
	const secondMessages = seg.messages.slice(localIndex);
	const tagPrefix = extractTagPrefix(seg.tags);

	const first: Segment = {
		id: generateId(),
		title: generateTitle(firstMessages),
		summary: seg.summary,
		tags: generateTags(firstMessages, tagPrefix),
		messages: firstMessages,
		startIndex: seg.startIndex,
		endIndex: seg.startIndex + localIndex - 1,
		confidence: seg.confidence,
		method: 'manual',
	};

	const second: Segment = {
		id: generateId(),
		title: generateTitle(secondMessages),
		summary: '',
		tags: generateTags(secondMessages, tagPrefix),
		messages: secondMessages,
		startIndex: atMessageIndex,
		endIndex: seg.endIndex,
		confidence: 0,
		method: 'manual',
	};

	const result = [...segments];
	result.splice(idx, 1, first, second);

	return result;
}

export function renameSegment(
	segments: Segment[],
	segmentId: string,
	newTitle: string
): Segment[] {
	return segments.map(s =>
		s.id === segmentId ? { ...s, title: newTitle } : s
	);
}

function extractTagPrefix(tags: string[]): string {
	if (tags.length === 0) return 'ai-chat';
	const first = tags[0];
	const slashIndex = first.indexOf('/');
	return slashIndex > 0 ? first.slice(0, slashIndex) : first;
}
