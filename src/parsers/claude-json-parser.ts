import type { ParsedConversation, Message, ContentBlock } from '../types';
import type { IChatParser, InputFormat, ParseOptions } from './parser-interface';

function generateId(): string {
	return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
}

export class ClaudeJsonParser implements IChatParser {
	readonly format: InputFormat = { source: 'claude', method: 'file-json' };

	canParse(input: string): boolean {
		try {
			const parsed = JSON.parse(input);
			if (Array.isArray(parsed)) {
				return parsed.length > 0 && parsed[0].chat_messages !== undefined;
			}
			return parsed.chat_messages !== undefined;
		} catch {
			return false;
		}
	}

	parse(input: string, options?: ParseOptions): ParsedConversation {
		const parsed = JSON.parse(input);
		const warnings: string[] = [];

		let chatMessages: unknown[];
		let convTitle = 'Untitled Chat';
		let convId = '';
		let createdAt: Date | null = null;
		let updatedAt: Date | null = null;

		if (Array.isArray(parsed)) {
			const conv = parsed[0];
			chatMessages = conv.chat_messages || [];
			convTitle = conv.name || conv.title || convTitle;
			convId = conv.uuid || conv.id || '';
			createdAt = conv.created_at ? new Date(conv.created_at) : null;
			updatedAt = conv.updated_at ? new Date(conv.updated_at) : null;
		} else if (parsed.chat_messages) {
			chatMessages = parsed.chat_messages;
			convTitle = parsed.name || parsed.title || convTitle;
			convId = parsed.uuid || parsed.id || '';
			createdAt = parsed.created_at ? new Date(parsed.created_at) : null;
			updatedAt = parsed.updated_at ? new Date(parsed.updated_at) : null;
		} else {
			chatMessages = [];
			warnings.push('No chat_messages found in input');
		}

		const messages: Message[] = [];
		let index = 0;

		for (const rawMsg of chatMessages) {
			const msg = rawMsg as Record<string, unknown>;
			const sender = msg.sender as string;

			if (sender !== 'human' && sender !== 'assistant') continue;

			const role: 'user' | 'assistant' = sender === 'human' ? 'user' : 'assistant';
			const contentBlocks = this.extractContentBlocks(msg);
			const plainText = (msg.text as string) || contentBlocks
				.filter(b => b.type === 'text')
				.map(b => 'content' in b ? b.content : '')
				.join('\n');

			if (!plainText.trim()) {
				warnings.push(`Empty ${role} message at index ${index} was skipped`);
				continue;
			}

			const timestamp = msg.created_at ? new Date(msg.created_at as string) : null;

			const attachments = Array.isArray(msg.attachments)
				? msg.attachments.map((a: Record<string, unknown>) => ({
					name: (a.file_name || a.name || 'attachment') as string,
					mimeType: a.file_type as string | undefined,
					size: a.file_size as number | undefined,
				}))
				: undefined;

			messages.push({
				id: (msg.uuid as string) || generateId(),
				index,
				role,
				contentBlocks,
				plainText,
				timestamp,
				metadata: {
					attachments,
				},
			});
			index++;
		}

		return {
			id: convId || generateId(),
			title: convTitle,
			source: 'claude',
			inputMethod: 'file-json',
			createdAt,
			updatedAt,
			messages,
			messageCount: messages.length,
			parseWarnings: warnings,
			sourceMetadata: {
				originalId: convId,
			},
		};
	}

	private extractContentBlocks(msg: Record<string, unknown>): ContentBlock[] {
		const blocks: ContentBlock[] = [];

		if (Array.isArray(msg.content)) {
			for (const item of msg.content) {
				const block = item as Record<string, unknown>;
				if (block.type === 'text') {
					blocks.push({ type: 'text', content: block.text as string });
				} else if (block.type === 'thinking') {
					blocks.push({ type: 'thinking', content: block.thinking as string });
				} else if (block.type === 'tool_use') {
					// Stripped per architecture spec
				} else if (block.type === 'tool_result') {
					// Stripped per architecture spec
				}
			}
		}

		if (blocks.length === 0 && msg.text) {
			blocks.push({ type: 'text', content: msg.text as string });
		}

		return blocks;
	}
}
