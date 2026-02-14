import { Modal, Setting, Notice, type App } from 'obsidian';
import type { ParsedConversation, Segment, ImportConfig, ChatSplitterSettings } from '../types';
import { GRANULARITY_PRESETS } from '../types';
import { parseInput, detectFormat, type InputFormat } from '../parsers';
import { segment, DEFAULT_SIGNAL_WEIGHTS } from '../segmentation';
import { generateNotes } from '../generators';
import { sanitizeFilename, resolveCollision } from '../generators/sanitize';
import { FolderSuggest } from './folder-suggest';

type InputMode = 'paste' | 'file';

export class ImportModal extends Modal {
	private settings: ChatSplitterSettings;
	private saveSettings: () => Promise<void>;
	private step: 1 | 2 = 1;
	private inputMode: InputMode;
	private rawInput = '';
	private conversation: ParsedConversation | null = null;
	private segments: Segment[] = [];
	private importConfig: ImportConfig;
	private detectedFormat: InputFormat | null = null;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		app: App,
		settings: ChatSplitterSettings,
		saveSettings: () => Promise<void>,
		mode: InputMode = 'paste'
	) {
		super(app);
		this.settings = settings;
		this.saveSettings = saveSettings;
		this.inputMode = mode;
		this.importConfig = this.buildDefaultConfig();
	}

	onOpen(): void {
		this.modalEl.addClass('chat-splitter-import-modal');
		this.renderStep1();
	}

	onClose(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}
		this.contentEl.empty();
	}

	private buildDefaultConfig(): ImportConfig {
		return {
			targetFolder: this.settings.defaultFolder,
			tagPrefix: this.settings.tagPrefix,
			granularity: this.settings.defaultGranularity,
			speakerStyle: this.settings.speakerStyle,
			keepFullTranscript: this.settings.keepFullTranscript,
			useOllama: false,
			namingTemplate: this.settings.namingTemplate,
			folderStructure: this.settings.folderStructure,
		};
	}

	private renderStep1(): void {
		this.contentEl.empty();
		this.step = 1;

		const header = this.contentEl.createDiv('chat-splitter-step-header');
		header.createEl('h2', { text: 'Import Chat - Step 1: Input' });

		const tabContainer = this.contentEl.createDiv('chat-splitter-tabs');
		const pasteTab = tabContainer.createEl('button', { text: 'Paste' });
		const fileTab = tabContainer.createEl('button', { text: 'File' });

		pasteTab.toggleClass('is-active', this.inputMode === 'paste');
		fileTab.toggleClass('is-active', this.inputMode === 'file');

		pasteTab.addEventListener('click', () => {
			this.inputMode = 'paste';
			this.renderStep1();
		});

		fileTab.addEventListener('click', () => {
			this.inputMode = 'file';
			this.renderStep1();
		});

		const badge = this.contentEl.createDiv('chat-splitter-format-badge');
		badge.setText('No format detected');

		if (this.inputMode === 'paste') {
			this.renderPasteInput(badge);
		} else {
			this.renderFileInput(badge);
		}

		const analyzeBtn = this.contentEl.createEl('button', {
			text: 'Analyze',
			cls: 'mod-cta',
		});
		analyzeBtn.disabled = !this.rawInput;
		analyzeBtn.addEventListener('click', () => this.handleAnalyze());

		const errorEl = this.contentEl.createDiv('chat-splitter-error');
		errorEl.style.display = 'none';
	}

	private renderPasteInput(badge: HTMLElement): void {
		const textarea = this.contentEl.createEl('textarea', {
			cls: 'chat-splitter-textarea',
			attr: { placeholder: 'Paste your chat conversation here...' },
		});
		textarea.value = this.rawInput;

		textarea.addEventListener('input', () => {
			this.rawInput = textarea.value;
			if (this.debounceTimer) clearTimeout(this.debounceTimer);
			this.debounceTimer = setTimeout(() => {
				this.updateFormatBadge(badge);
				const btn = this.contentEl.querySelector('.mod-cta') as HTMLButtonElement;
				if (btn) btn.disabled = !this.rawInput.trim();
			}, 300);
		});
	}

	private renderFileInput(badge: HTMLElement): void {
		const fileContainer = this.contentEl.createDiv('chat-splitter-file-input');
		const fileInput = fileContainer.createEl('input', {
			attr: { type: 'file', accept: '.json,.zip,.md', style: 'display: none' },
		});

		const chooseBtn = fileContainer.createEl('button', { text: 'Choose File' });
		const fileLabel = fileContainer.createSpan({ text: 'No file selected' });

		chooseBtn.addEventListener('click', () => fileInput.click());

		fileInput.addEventListener('change', async () => {
			const file = fileInput.files?.[0];
			if (!file) return;

			fileLabel.setText(file.name);

			if (file.name.endsWith('.zip')) {
				const buffer = await file.arrayBuffer();
				this.rawInput = new TextDecoder().decode(buffer);
			} else {
				this.rawInput = await file.text();
			}

			this.updateFormatBadge(badge);
			const btn = this.contentEl.querySelector('.mod-cta') as HTMLButtonElement;
			if (btn) btn.disabled = !this.rawInput.trim();
		});
	}

	private updateFormatBadge(badge: HTMLElement): void {
		if (!this.rawInput.trim()) {
			badge.setText('No format detected');
			badge.className = 'chat-splitter-format-badge';
			return;
		}

		try {
			const format = detectFormat(this.rawInput);
			this.detectedFormat = format;
			badge.setText(`${format.source} (${format.method})`);
			badge.className = 'chat-splitter-format-badge detected';
		} catch {
			badge.setText('Unknown format');
			badge.className = 'chat-splitter-format-badge unknown';
		}
	}

	private async handleAnalyze(): Promise<void> {
		const errorEl = this.contentEl.querySelector('.chat-splitter-error') as HTMLElement;

		try {
			if (errorEl) {
				errorEl.style.display = 'none';
				errorEl.setText('');
			}

			this.conversation = parseInput(this.rawInput);

			const config = {
				granularity: this.importConfig.granularity,
				method: 'heuristic' as const,
				signalWeights: DEFAULT_SIGNAL_WEIGHTS,
				thresholds: GRANULARITY_PRESETS[this.importConfig.granularity],
			};

			this.segments = segment(this.conversation, config, this.importConfig.tagPrefix);
			this.renderStep2();
		} catch (err) {
			if (errorEl) {
				errorEl.style.display = 'block';
				errorEl.setText(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
			}
		}
	}

	private renderStep2(): void {
		this.contentEl.empty();
		this.step = 2;

		const header = this.contentEl.createDiv('chat-splitter-step-header');
		header.createEl('h2', { text: 'Import Chat - Step 2: Configure' });

		const summary = this.contentEl.createDiv('chat-splitter-summary-card');
		summary.createEl('p', {
			text: `Found ${this.segments.length} topic${this.segments.length !== 1 ? 's' : ''} in ${this.conversation?.messageCount || 0} messages`,
		});

		const settingsContainer = this.contentEl.createDiv();

		new Setting(settingsContainer)
			.setName('Target folder')
			.setDesc('Where to save the generated notes')
			.addText(text => {
				text.setValue(this.importConfig.targetFolder);
				text.onChange(value => { this.importConfig.targetFolder = value; });
				new FolderSuggest(this.app, text.inputEl);
			});

		new Setting(settingsContainer)
			.setName('Tag prefix')
			.addText(text => {
				text.setValue(this.importConfig.tagPrefix);
				text.onChange(value => { this.importConfig.tagPrefix = value; });
			});

		new Setting(settingsContainer)
			.setName('Granularity')
			.setDesc('How aggressively to split topics')
			.addDropdown(drop => {
				drop.addOption('coarse', 'Coarse (fewer segments)');
				drop.addOption('medium', 'Medium');
				drop.addOption('fine', 'Fine (more segments)');
				drop.setValue(this.importConfig.granularity);
				drop.onChange(value => {
					this.importConfig.granularity = value as 'coarse' | 'medium' | 'fine';
					this.reRunSegmentation();
				});
			});

		new Setting(settingsContainer)
			.setName('Speaker style')
			.addDropdown(drop => {
				drop.addOption('callouts', 'Callouts');
				drop.addOption('blockquotes', 'Blockquotes');
				drop.addOption('bold', 'Bold');
				drop.setValue(this.importConfig.speakerStyle);
				drop.onChange(value => {
					this.importConfig.speakerStyle = value as 'callouts' | 'blockquotes' | 'bold';
				});
			});

		new Setting(settingsContainer)
			.setName('Keep full transcript')
			.setDesc('Also create a single note with the full conversation')
			.addToggle(toggle => {
				toggle.setValue(this.importConfig.keepFullTranscript);
				toggle.onChange(value => { this.importConfig.keepFullTranscript = value; });
			});

		if (this.settings.enableOllama) {
			new Setting(settingsContainer)
				.setName('Use Ollama')
				.setDesc('Use local LLM for enhanced segmentation')
				.addToggle(toggle => {
					toggle.setValue(this.importConfig.useOllama);
					toggle.onChange(value => { this.importConfig.useOllama = value; });
				});
		}

		const buttonContainer = this.contentEl.createDiv('chat-splitter-buttons');

		const backBtn = buttonContainer.createEl('button', { text: 'Back' });
		backBtn.addEventListener('click', () => this.renderStep1());

		const createBtn = buttonContainer.createEl('button', {
			text: `Create ${this.segments.length + 1} Notes`,
			cls: 'mod-cta',
		});
		createBtn.addEventListener('click', () => this.handleCreate());
	}

	private reRunSegmentation(): void {
		if (!this.conversation) return;

		const config = {
			granularity: this.importConfig.granularity,
			method: 'heuristic' as const,
			signalWeights: DEFAULT_SIGNAL_WEIGHTS,
			thresholds: GRANULARITY_PRESETS[this.importConfig.granularity],
		};

		this.segments = segment(this.conversation, config, this.importConfig.tagPrefix);

		const summaryEl = this.contentEl.querySelector('.chat-splitter-summary-card p');
		if (summaryEl) {
			summaryEl.setText(
				`Found ${this.segments.length} topic${this.segments.length !== 1 ? 's' : ''} in ${this.conversation.messageCount} messages`
			);
		}

		const createBtn = this.contentEl.querySelector('.mod-cta') as HTMLButtonElement;
		if (createBtn) {
			createBtn.setText(`Create ${this.segments.length + 1} Notes`);
		}
	}

	private async handleCreate(): Promise<void> {
		if (!this.conversation) return;

		const createBtn = this.contentEl.querySelector('.mod-cta') as HTMLButtonElement;
		if (createBtn) createBtn.disabled = true;

		try {
			const notes = generateNotes(
				this.conversation,
				this.segments,
				this.importConfig,
				this.settings.customFrontmatter
			);

			for (let i = 0; i < notes.length; i++) {
				if (createBtn) {
					createBtn.setText(`Creating... (${i + 1}/${notes.length})`);
				}

				const note = notes[i];
				const folderPath = note.path.substring(0, note.path.lastIndexOf('/'));

				if (folderPath && !this.app.vault.getAbstractFileByPath(folderPath)) {
					await this.app.vault.createFolder(folderPath);
				}

				const resolvedPath = resolveCollision(note.path, this.app.vault);
				await this.app.vault.create(resolvedPath, note.content);
			}

			const indexNote = notes.find(n => n.isIndex);
			if (indexNote) {
				const file = this.app.vault.getAbstractFileByPath(indexNote.path);
				if (file) {
					await this.app.workspace.openLinkText(indexNote.path, '', false);
				}
			}

			new Notice(`Created ${notes.length} notes from chat conversation`);
			this.close();
		} catch (err) {
			new Notice(`Error creating notes: ${err instanceof Error ? err.message : String(err)}`);
			if (createBtn) {
				createBtn.disabled = false;
				createBtn.setText(`Create ${this.segments.length + 1} Notes`);
			}
		}
	}
}
