let debugEnabled = false;

export function setDebugLogging(enabled: boolean): void {
	debugEnabled = enabled;
}

export function debugLog(...args: unknown[]): void {
	if (debugEnabled) {
		console.debug('[Chat Splitter]', ...args);
	}
}
