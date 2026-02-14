import type { Vault } from 'obsidian';

const INVALID_CHARS = /[\\/:*?"<>|]/g;
const MULTI_DASH_SPACE = /[-\s]{2,}/g;
const MAX_FILENAME_LENGTH = 200;

export function sanitizeFilename(name: string): string {
	let sanitized = name
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
