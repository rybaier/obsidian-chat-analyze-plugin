import type { Vault } from 'obsidian';

const INVALID_CHARS = /[\\/:*?"<>|]/g;
const MULTI_DASH_SPACE = /[-\s]{2,}/g;
const MAX_FILENAME_LENGTH = 200;

/**
 * Unicode -> ASCII normalization applied before INVALID_CHARS stripping.
 * Prevents smart quotes, em dashes, etc. from leaking into filenames.
 */
function normalizeUnicode(text: string): string {
	return text
		// Smart double quotes -> straight double quote (caught by INVALID_CHARS)
		.replace(/[\u201C\u201D]/g, '"')
		// Smart single quotes / curly apostrophes -> straight single quote
		.replace(/[\u2018\u2019]/g, "'")
		// Em dash -> hyphen
		.replace(/\u2014/g, '-')
		// En dash -> hyphen
		.replace(/\u2013/g, '-')
		// Ellipsis -> three dots
		.replace(/\u2026/g, '...')
		// Non-breaking space -> regular space
		.replace(/\u00A0/g, ' ');
}

export function sanitizeFilename(name: string): string {
	let sanitized = normalizeUnicode(name)
		.replace(INVALID_CHARS, '-')
		.replace(MULTI_DASH_SPACE, ' ')
		.trim()
		.replace(/^\.+|\.+$/g, '');

	if (sanitized.length > MAX_FILENAME_LENGTH) {
		sanitized = sanitized.slice(0, MAX_FILENAME_LENGTH).trim();
	}

	return sanitized || 'Untitled';
}

export function resolveCollision(path: string, vault: Vault): string {
	if (!vault.getAbstractFileByPath(path)) {
		return path;
	}

	const dotIndex = path.lastIndexOf('.md');
	const base = dotIndex > 0 ? path.slice(0, dotIndex) : path;
	const ext = dotIndex > 0 ? '.md' : '';

	let counter = 2;
	while (vault.getAbstractFileByPath(`${base} (${counter})${ext}`)) {
		counter++;
	}

	return `${base} (${counter})${ext}`;
}
