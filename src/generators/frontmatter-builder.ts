import type { NoteFrontmatter } from '../types';

export function buildFrontmatter(data: NoteFrontmatter, customFrontmatter?: string): string {
	const lines: string[] = ['---'];

	lines.push(`cssclasses: [${data.cssclasses.join(', ')}]`);
	lines.push(`source: ${data.source}`);
	lines.push(`conversation_id: ${escapeYaml(data.conversation_id)}`);
	lines.push(`conversation_title: ${escapeYaml(data.conversation_title)}`);

	if (data.segment !== undefined) {
		lines.push(`segment: ${data.segment}`);
	}
	if (data.segment_total !== undefined) {
		lines.push(`segment_total: ${data.segment_total}`);
	}
	if (data.topic) {
		lines.push(`topic: ${escapeYaml(data.topic)}`);
	}

	lines.push(`date: ${data.date}`);
	lines.push(`date_imported: ${data.date_imported}`);
	lines.push(`tags: [${data.tags.join(', ')}]`);
	lines.push(`message_count: ${data.message_count}`);

	if (data.prev) {
		lines.push(`prev: "${data.prev}"`);
	}
	if (data.next) {
		lines.push(`next: "${data.next}"`);
	}
	if (data.parent) {
		lines.push(`parent: "${data.parent}"`);
	}

	if (customFrontmatter) {
		const customLines = parseCustomFrontmatter(customFrontmatter);
		for (const line of customLines) {
			lines.push(line);
		}
	}

	lines.push('---');
	return lines.join('\n');
}

function escapeYaml(value: string): string {
	if (/[:#\[\]{}|>&*!%@`'",?]/.test(value) || value.includes('\n')) {
		return `"${value.replace(/"/g, '\\"')}"`;
	}
	return value;
}

function parseCustomFrontmatter(input: string): string[] {
	const lines: string[] = [];
	const trimmed = input.trim();
	if (!trimmed) return lines;

	for (const line of trimmed.split('\n')) {
		const cleaned = line.trim();
		if (cleaned && /^\w[\w-]*\s*:/.test(cleaned)) {
			lines.push(cleaned);
		}
	}

	return lines;
}
