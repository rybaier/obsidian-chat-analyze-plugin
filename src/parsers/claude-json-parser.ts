import type { ParsedConversation, Message, ContentBlock } from '../types';
import type { IChatParser, InputFormat, ParseOptions } from './parser-interface';

interface ClaudeContentBlock {
	type?: string;
	text?: string;
	thinking?: string;
}

interface ClaudeChatMessage {
	sender?: string;
	text?: string;
	content?: ClaudeContentBlock[];
	created_at?: string;
	uuid?: string;
	attachments?: ClaudeAttachment[];
}

interface ClaudeAttachment {
	file_name?: string;
	name?: string;
	file_type?: string;
	file_size?: number;
}

interface ClaudeConversation {
	chat_messages?: ClaudeChatMessage[];
	name?: string;
	title?: string;
	uuid?: string;
	id?: string;
	created_at?: string;
	updated_at?: string;
}

function generateId(): string {
	return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
}

export class ClaudeJsonParser implements IChatParser {
	readonly format: InputFormat = { source: 'claude', method: 'file-json' };

	canParse(input: string): boolean {
		try {
			const parsed = JSON.parse(input) as ClaudeConversation | ClaudeConversation[];
			if (Array.isArray(parsed)) {
				return parsed.length > 0 && parsed[0].chat_messages !== undefined;
			}
			return parsed.chat_messages !== undefined;
		} catch {
			return false;
		}
	}

	parse(input: string, options?: ParseOptions): ParsedConversation {
		const parsed = JSON.parse(input) as ClaudeConversation | ClaudeConversation[];
		const warnings: string[] = [];

		let chatMessages: ClaudeChatMessage[];
		let convTitle = 'Untitled Chat';
		let convId = '';
		let createdAt: Date | null = null;
		let updatedAt: Date | null = null;

		if (Array.isArray(parsed)) {
			const conv: ClaudeConversation = parsed[0];
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
			const sender = rawMsg.sender;

			if (sender !== 'human' && sender !== 'assistant') continue;

			const role: 'user' | 'assistant' = sender === 'human' ? 'user' : 'assistant';
			const contentBlocks = this.extractContentBlocks(rawMsg);
			const plainText = rawMsg.text || contentBlocks
				.filter(b => b.type === 'text')
				.map(b => 'content' in b ? b.content : '')
				.join('\n');

			if (!plainText.trim()) {
				warnings.push(`Empty ${role} message at index ${index} was skipped`);
				continue;
			}

			const timestamp = rawMsg.created_at ? new Date(rawMsg.created_at) : null;

			const attachments = Array.isArray(rawMsg.attachments)
				? rawMsg.attachments.map((a: ClaudeAttachment) => ({
					name: a.file_name || a.name || 'attachment',
					mimeType: a.file_type,
					size: a.file_size,
				}))
				: undefined;

			messages.push({
				id: rawMsg.uuid || generateId(),
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
			contentType: 'chat',
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

	private extractContentBlocks(msg: ClaudeChatMessage): ContentBlock[] {
		const blocks: ContentBlock[] = [];

		if (Array.isArray(msg.content)) {
			for (const block of msg.content) {
				if (block.type === 'text') {
					blocks.push({ type: 'text', content: block.text || '' });
				} else if (block.type === 'thinking') {
					blocks.push({ type: 'thinking', content: block.thinking || '' });
				} else if (block.type === 'tool_use') {
					// Stripped per architecture spec
				} else if (block.type === 'tool_result') {
					// Stripped per architecture spec
				}
			}
		}

		if (blocks.length === 0 && msg.text) {
			blocks.push({ type: 'text', content: msg.text });
		}

		return blocks;
	}
}
