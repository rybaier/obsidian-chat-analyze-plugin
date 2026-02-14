import type { SpeakerStyle, FolderStructure } from './settings';
import type { Granularity } from './segment';

export interface ImportConfig {
	targetFolder: string;
	tagPrefix: string;
	granularity: Granularity;
	speakerStyle: SpeakerStyle;
	keepFullTranscript: boolean;
	useOllama: boolean;
	namingTemplate: string;
	folderStructure: FolderStructure;
}
