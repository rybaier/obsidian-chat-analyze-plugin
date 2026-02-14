export type {
	ChatSource,
	InputMethod,
	SpeakerRole,
	TextBlock,
	CodeBlock,
	ThinkingBlock,
	ArtifactBlock,
	ToolUseBlock,
	ImageBlock,
	ContentBlock,
	Attachment,
	Message,
	ParsedConversation,
} from './conversation';

export type {
	Granularity,
	SegmentationMethod,
	SignalResult,
	SegmentBoundary,
	Segment,
	GranularityThresholds,
	SegmentationConfig,
} from './segment';
export { GRANULARITY_PRESETS } from './segment';

export type {
	NoteFrontmatter,
	NoteLink,
	GeneratedNote,
} from './generated-note';

export type {
	SpeakerStyle,
	FolderStructure,
	ChatSplitterSettings,
} from './settings';
export { DEFAULT_SETTINGS } from './settings';

export type { ImportConfig } from './import-config';
