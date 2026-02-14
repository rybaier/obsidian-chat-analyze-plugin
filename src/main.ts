import { Plugin } from 'obsidian';
import type { ChatSplitterSettings } from './types';
import { DEFAULT_SETTINGS } from './types';
import { ImportModal } from './ui/import-modal';
import { ChatSplitterSettingTab } from './ui/settings-tab';
import { setDebugLogging } from './utils/debug-log';

export default class ChatSplitterPlugin extends Plugin {
	settings: ChatSplitterSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();
		setDebugLogging(this.settings.debugLogging);

		this.addCommand({
			id: 'import-paste',
			name: 'Import from clipboard',
			callback: () => {
				new ImportModal(this.app, this.settings, () => this.saveSettings(), 'paste').open();
			},
		});

		this.addCommand({
			id: 'import-file',
			name: 'Import from file',
			callback: () => {
				new ImportModal(this.app, this.settings, () => this.saveSettings(), 'file').open();
			},
		});

		this.addRibbonIcon('scissors', 'Chat Splitter: Import', () => {
			new ImportModal(this.app, this.settings, () => this.saveSettings(), 'paste').open();
		});

		this.addSettingTab(new ChatSplitterSettingTab(this.app, this));
	}

	onunload(): void {
		// cleanup handled by Obsidian
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		setDebugLogging(this.settings.debugLogging);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		setDebugLogging(this.settings.debugLogging);
	}
}
