import type { ParsedConversation } from '../types';

export type InputFormat =
	| { source: 'chatgpt'; method: 'paste' }
	| { source: 'chatgpt'; method: 'file-json' }
	| { source: 'claude'; method: 'paste' }
	| { source: 'claude'; method: 'file-json' }
	| { source: 'markdown'; method: 'paste' }
	| { source: 'markdown'; method: 'file-markdown' };

export interface ParseOptions {
	conversationId?: string;
	branchStrategy?: 'current' | 'longest';
}

export interface IChatParser {
	readonly format: InputFormat;
	canParse(input: string): boolean;
	parse(input: string, options?: ParseOptions): ParsedConversation;
}
