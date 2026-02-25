import type { Message } from '../types';

export interface KeyInfo {
	summary: string;
	keyPoints: string[];
	links: string[];
	tags: string[];
}

const URL_REGEX = /https?:\/\/[^\s)<>"\]]+/g;

// Tracking parameters to strip from URLs
const TRACKING_PARAMS = new Set([
	'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
	'fbclid', 'gclid', 'ref', 'source', 'mc_cid', 'mc_eid',
]);

export function extractKeyInfo(
	messages: Message[],
	summary: string,
	tags: string[]
): KeyInfo {
	return {
		summary,
		keyPoints: extractKeyPoints(messages),
		links: extractLinks(messages),
		tags,
	};
}

function extractKeyPoints(messages: Message[]): string[] {
	const filtered = messages.filter(m => m.role === 'assistant');
	const assistantMessages = filtered.length > 0 ? filtered : messages;
	const points: string[] = [];

	// Try extracting from markdown list items first
	for (const msg of assistantMessages) {
		const lines = msg.plainText.split('\n');
		for (const line of lines) {
			const listMatch = line.match(/^\s{0,4}[-*+]\s+(.+)/) || line.match(/^\s{0,4}\d+\.\s+(.+)/);
			if (!listMatch) continue;

			const item = listMatch[1].trim();
			// Skip short items, pure formatting, or items that are just punctuation
			if (item.length < 10) continue;
			if (/^[-_=*~`#]+$/.test(item)) continue;

			// Prefer top-level items (0-4 spaces indent)
			const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
			if (indent > 4) continue;

			// Clean markdown formatting from the item
			const cleaned = item
				.replace(/\*\*([^*]+)\*\*/g, '$1')
				.replace(/\*([^*]+)\*/g, '$1')
				.replace(/`([^`]+)`/g, '$1')
				.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

			if (cleaned.length >= 10 && !points.includes(cleaned)) {
				points.push(cleaned);
			}

			if (points.length >= 6) break;
		}
		if (points.length >= 6) break;
	}

	// Fallback: extract markdown headings as topic structure
	if (points.length === 0) {
		for (const msg of assistantMessages) {
			const lines = msg.plainText.split('\n');
			for (const line of lines) {
				const headingMatch = line.match(/^#{2,4}\s+(.+)/);
				if (!headingMatch) continue;

				const heading = headingMatch[1].trim();
				if (heading.length < 5) continue;

				const cleaned = heading
					.replace(/\*\*([^*]+)\*\*/g, '$1')
					.replace(/`([^`]+)`/g, '$1');

				if (cleaned.length >= 5 && !points.includes(cleaned)) {
					points.push(cleaned);
				}

				if (points.length >= 6) break;
			}
			if (points.length >= 6) break;
		}
	}

	return points;
}

export function extractLinks(messages: Message[]): string[] {
	const seen = new Set<string>();
	const links: string[] = [];

	for (const msg of messages) {
		const matches = msg.plainText.matchAll(URL_REGEX);
		for (const match of matches) {
			const cleaned = cleanUrl(match[0]);
			if (cleaned && !seen.has(cleaned)) {
				seen.add(cleaned);
				links.push(formatUrlAsMarkdown(cleaned));
			}
		}
	}

	return links;
}

function cleanUrl(url: string): string {
	// Strip trailing punctuation that's not part of the URL
	let cleaned = url.replace(/[.)>,;:!?]+$/, '');

	try {
		const parsed = new URL(cleaned);
		// Remove tracking parameters
		const params = new URLSearchParams(parsed.search);
		for (const key of [...params.keys()]) {
			if (TRACKING_PARAMS.has(key)) {
				params.delete(key);
			}
		}
		parsed.search = params.toString();
		cleaned = parsed.toString();
		// Remove trailing slash for cleanliness
		if (cleaned.endsWith('/') && parsed.pathname === '/') {
			cleaned = cleaned.slice(0, -1);
		}
	} catch {
		// If URL parsing fails, return as-is
	}

	return cleaned;
}

function formatUrlAsMarkdown(url: string): string {
	try {
		const parsed = new URL(url);
		const domain = parsed.hostname.replace(/^www\./, '');
		return `[${domain}](${url})`;
	} catch {
		return url;
	}
}

export function renderKeyInfoBlock(keyInfo: KeyInfo): string {
	const sections: string[] = [];

	// Summary section (always shown)
	const tagLine = keyInfo.tags.length > 0
		? `\n> **Tags:** ${keyInfo.tags.map(t => '`' + t + '`').join(' ')}`
		: '';
	sections.push(`> [!abstract] Summary\n> ${keyInfo.summary}${tagLine}`);

	// Key points section (only if we have points)
	if (keyInfo.keyPoints.length > 0) {
		const pointLines = keyInfo.keyPoints.map(p => `> - ${p}`).join('\n');
		sections.push(`> [!note] Key Points\n${pointLines}`);
	}

	// Links section (only if we have links)
	if (keyInfo.links.length > 0) {
		const linkLines = keyInfo.links.map(l => `> - ${l}`).join('\n');
		sections.push(`> [!link] References\n${linkLines}`);
	}

	return sections.join('\n\n');
}
