import type { Message } from '../../types';

export interface MessageChunk {
	messages: Message[];
	startIndex: number;
	endIndex: number;
}

const DEFAULT_TARGET_CHARS = 12000;
const DEFAULT_OVERLAP_MESSAGES = 4;

export function chunkConversation(
	messages: Message[],
	targetChars: number = DEFAULT_TARGET_CHARS,
	overlapMessages: number = DEFAULT_OVERLAP_MESSAGES
): MessageChunk[] {
	if (messages.length === 0) {
		return [];
	}

	const totalChars = messages.reduce((sum, m) => sum + m.plainText.length, 0);

	if (totalChars <= targetChars) {
		return [{
			messages: [...messages],
			startIndex: messages[0].index,
			endIndex: messages[messages.length - 1].index,
		}];
	}

	const chunks: MessageChunk[] = [];
	let chunkStart = 0;

	while (chunkStart < messages.length) {
		let charCount = 0;
		let chunkEnd = chunkStart;

		while (chunkEnd < messages.length && charCount < targetChars) {
			charCount += messages[chunkEnd].plainText.length;
			chunkEnd++;
		}

		const chunkMessages = messages.slice(chunkStart, chunkEnd);
		chunks.push({
			messages: chunkMessages,
			startIndex: chunkMessages[0].index,
			endIndex: chunkMessages[chunkMessages.length - 1].index,
		});

		const nextStart = chunkEnd - overlapMessages;
		if (nextStart <= chunkStart) {
			break;
		}
		chunkStart = nextStart;

		if (chunkEnd >= messages.length) {
			break;
		}
	}

	return chunks;
}
