export type SpeakerStyle = 'callouts' | 'blockquotes' | 'bold' | 'plain';

export type FolderStructure = 'nested' | 'flat';

export interface ChatSplitterSettings {
	defaultFolder: string;
	namingTemplate: string;
	tagPrefix: string;
	folderStructure: FolderStructure;

	defaultGranularity: 'coarse' | 'medium' | 'fine';
	minSegmentMessages: number;
	minSegmentWords: number;
	alwaysPreview: boolean;

	speakerStyle: SpeakerStyle;
	showTimestamps: boolean;
	collapseLongMessages: boolean;
	collapseThreshold: number;
	keepFullTranscript: boolean;

	enableOllama: boolean;
	ollamaEndpoint: string;
	ollamaModel: string;

	customFrontmatter: string;
	debugLogging: boolean;
}

export const DEFAULT_SETTINGS: ChatSplitterSettings = {
	defaultFolder: 'AI Chats',
	namingTemplate: '{{topic}}',
	tagPrefix: 'ai-chat',
	folderStructure: 'nested',

	defaultGranularity: 'medium',
	minSegmentMessages: 4,
	minSegmentWords: 200,
	alwaysPreview: false,

	speakerStyle: 'callouts',
	showTimestamps: true,
	collapseLongMessages: true,
	collapseThreshold: 800,
	keepFullTranscript: false,

	enableOllama: false,
	ollamaEndpoint: 'http://localhost:11434',
	ollamaModel: '',

	customFrontmatter: '',
	debugLogging: false,
};
