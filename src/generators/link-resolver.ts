import type { Segment, NoteLink } from '../types';
import { renderTemplate } from '../utils/templates';
import { sanitizeFilename } from './sanitize';

export function resolveLinks(
	segments: Segment[],
	indexNoteName: string,
	namingTemplate: string,
	variables: Record<string, string>
): NoteLink[][] {
	const noteNames = segments.map((seg, i) => {
		const vars = {
			...variables,
			topic: seg.title,
			segment: String(i + 1),
			segment_total: String(segments.length),
		};
		return sanitizeFilename(renderTemplate(namingTemplate, vars));
	});

	return segments.map((_, i) => {
		const links: NoteLink[] = [];

		if (i > 0) {
			links.push({
				type: 'prev',
				target: noteNames[i - 1],
			});
		}

		links.push({
			type: 'parent',
			target: indexNoteName,
			display: 'Back to Index',
		});

		if (i < segments.length - 1) {
			links.push({
				type: 'next',
				target: noteNames[i + 1],
			});
		}

		return links;
	});
}

export function renderNavigationFooter(links: NoteLink[]): string {
	const parts: string[] = [];

	const prev = links.find(l => l.type === 'prev');
	const parent = links.find(l => l.type === 'parent');
	const next = links.find(l => l.type === 'next');

	if (prev) {
		parts.push(`Previous: [[${prev.target}]]`);
	}

	if (parent) {
		parts.push(`[[${parent.target}|${parent.display || 'Index'}]]`);
	}

	if (next) {
		parts.push(`Next: [[${next.target}]]`);
	}

	if (parts.length === 0) return '';

	return `---\n> [!info] Navigation\n> ${parts.join(' | ')}`;
}
