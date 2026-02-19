export type ChatSource = 'chatgpt' | 'claude' | 'markdown';

export type ContentType = 'chat' | 'document';

export type InputMethod = 'paste' | 'file-json' | 'file-zip' | 'file-markdown';

export type SpeakerRole = 'user' | 'assistant' | 'system' | 'tool';

export interface TextBlock {
	type: 'text';
	content: string;
}

export interface CodeBlock {
	type: 'code';
	language: string;
	content: string;
	filename?: string;
}

export interface ThinkingBlock {
	type: 'thinking';
	content: string;
}

export interface ArtifactBlock {
	type: 'artifact';
	title: string;
	artifactType: string;
	language?: string;
	content: string;
}

export interface ToolUseBlock {
	type: 'tool_use';
	toolName: string;
	input: string;
	output?: string;
}

export interface ImageBlock {
	type: 'image';
	altText: string;
	url?: string;
}

export type ContentBlock =
	| TextBlock
	| CodeBlock
	| ThinkingBlock
	| ArtifactBlock
	| ToolUseBlock
	| ImageBlock;

export interface Attachment {
	name: string;
	mimeType?: string;
	size?: number;
}

export interface Message {
	id: string;
	index: number;
	role: SpeakerRole;
	contentBlocks: ContentBlock[];
	plainText: string;
	timestamp: Date | null;
	metadata: {
		model?: string;
		attachments?: Attachment[];
	};
}

export interface ParsedConversation {
	id: string;
	title: string;
	source: ChatSource;
	contentType: ContentType;
	inputMethod: InputMethod;
	createdAt: Date | null;
	updatedAt: Date | null;
	messages: Message[];
	messageCount: number;
	parseWarnings: string[];
	sourceMetadata: {
		originalId?: string;
		defaultModel?: string;
		sourceUrl?: string;
	};
}
