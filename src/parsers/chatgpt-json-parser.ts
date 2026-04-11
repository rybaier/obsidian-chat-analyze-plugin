import type { ParsedConversation, Message, ContentBlock } from '../types';
import type { IChatParser, InputFormat, ParseOptions } from './parser-interface';

interface ChatGPTMessageContent {
	content_type?: string;
	parts?: (string | ChatGPTImagePart)[];
	text?: string;
}

interface ChatGPTImagePart {
	content_type?: string;
	asset_pointer?: string;
	metadata?: {
		dalle?: {
			prompt?: string;
		};
	};
}

interface ChatGPTMessage {
	author?: { role?: string };
	content?: ChatGPTMessageContent;
	create_time?: number;
	metadata?: { model_slug?: string };
}

interface ChatGPTNode {
	id?: string;
	message?: ChatGPTMessage;
	parent?: string;
}

interface ChatGPTConversation {
	id?: string;
	title?: string;
	mapping?: Record<string, ChatGPTNode>;
	current_node?: string;
	create_time?: number;
	update_time?: number;
	default_model_slug?: string;
}

function generateId(): string {
	return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
}

interface ConversationSummary {
	id: string;
	title: string;
	messageCount: number;
}

export function listConversations(json: string): ConversationSummary[] {
	const parsed = JSON.parse(json) as ChatGPTConversation | ChatGPTConversation[];
	const conversations = Array.isArray(parsed) ? parsed : [parsed];

	return conversations.map(conv => ({
		id: conv.id || '',
		title: conv.title || 'Untitled',
		messageCount: Object.keys(conv.mapping || {}).length,
	}));
}

export class ChatGPTJsonParser implements IChatParser {
	readonly format: InputFormat = { source: 'chatgpt', method: 'file-json' };

	canParse(input: string): boolean {
		try {
			const parsed = JSON.parse(input) as ChatGPTConversation | ChatGPTConversation[];
			if (Array.isArray(parsed)) {
				return parsed.length > 0 && parsed[0].mapping !== undefined;
			}
			return parsed.mapping !== undefined;
		} catch {
			return false;
		}
	}

	parse(input: string, options?: ParseOptions): ParsedConversation {
		const parsed = JSON.parse(input) as ChatGPTConversation | ChatGPTConversation[];
		const conversations = Array.isArray(parsed) ? parsed : [parsed];

		let conv = conversations[0];
		if (options?.conversationId) {
			const found = conversations.find(c => c.id === options.conversationId);
			if (found) conv = found;
		}

		const warnings: string[] = [];
		const mapping = conv.mapping || {};
		const currentNode = conv.current_node;

		const orderedNodes = this.walkCurrentBranch(mapping, currentNode, warnings);

		const messages: Message[] = [];
		let index = 0;

		for (const node of orderedNodes) {
			const msg = node.message;
			if (!msg) continue;

			const role = msg.author?.role;
			if (role !== 'user' && role !== 'assistant') continue;

			const contentBlocks = this.extractContentBlocks(msg, warnings);
			const plainText = contentBlocks
				.filter(b => b.type === 'text' || b.type === 'code')
				.map(b => 'content' in b ? b.content : '')
				.join('\n');

			if (!plainText.trim()) {
				warnings.push(`Empty ${role} message at node ${node.id} was skipped`);
				continue;
			}

			const timestamp = msg.create_time
				? new Date(msg.create_time * 1000)
				: null;

			messages.push({
				id: node.id || generateId(),
				index,
				role,
				contentBlocks,
				plainText,
				timestamp,
				metadata: {
					model: msg.metadata?.model_slug,
				},
			});
			index++;
		}

		const title = conv.title || this.extractTitle(messages);

		return {
			id: conv.id || generateId(),
			title,
			source: 'chatgpt',
			contentType: 'chat',
			inputMethod: 'file-json',
			createdAt: conv.create_time ? new Date(conv.create_time * 1000) : null,
			updatedAt: conv.update_time ? new Date(conv.update_time * 1000) : null,
			messages,
			messageCount: messages.length,
			parseWarnings: warnings,
			sourceMetadata: {
				originalId: conv.id,
				defaultModel: conv.default_model_slug,
			},
		};
	}

	private walkCurrentBranch(mapping: Record<string, ChatGPTNode>, currentNodeId: string | undefined, warnings: string[]): ChatGPTNode[] {
		if (!currentNodeId || !mapping[currentNodeId]) {
			warnings.push('No current_node found; walking all nodes');
			return Object.values(mapping).filter(n => n.message);
		}

		const chain: ChatGPTNode[] = [];
		let nodeId: string | undefined = currentNodeId;

		while (nodeId && mapping[nodeId]) {
			chain.unshift(mapping[nodeId]);
			nodeId = mapping[nodeId].parent;
		}

		return chain;
	}

	private extractContentBlocks(msg: ChatGPTMessage, warnings: string[]): ContentBlock[] {
		const blocks: ContentBlock[] = [];
		const content = msg.content;

		if (!content || !content.parts) {
			if (content?.text) {
				blocks.push({ type: 'text', content: content.text });
			}
			return blocks;
		}

		const contentType = content.content_type || 'text';

		for (const part of content.parts) {
			if (typeof part === 'string') {
				if (contentType === 'code') {
					blocks.push({ type: 'code', language: '', content: part });
				} else {
					blocks.push({ type: 'text', content: part });
				}
			} else if (typeof part === 'object' && part !== null) {
				if (part.content_type === 'image_asset_pointer' || part.asset_pointer) {
					blocks.push({
						type: 'image',
						altText: part.metadata?.dalle?.prompt || 'Image',
						url: undefined,
					});
				} else {
					blocks.push({ type: 'text', content: JSON.stringify(part) });
				}
			}
		}

		return blocks;
	}

	private extractTitle(messages: Message[]): string {
		const firstUser = messages.find(m => m.role === 'user');
		if (firstUser) {
			const text = firstUser.plainText.slice(0, 50);
			return text.length < firstUser.plainText.length ? text + '...' : text;
		}
		return 'Untitled Chat';
	}
}
