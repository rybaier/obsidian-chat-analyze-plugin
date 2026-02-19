import { Modal, Setting, Notice, type App } from 'obsidian';
import JSZip from 'jszip';
import type { ParsedConversation, Segment, ImportConfig, ChatSplitterSettings, SpeakerStyle } from '../types';
import { GRANULARITY_PRESETS } from '../types';
import { parseInput, detectFormat, listConversations, type InputFormat } from '../parsers';
import { segment, segmentWithFallback, DEFAULT_SIGNAL_WEIGHTS } from '../segmentation';
import { generateNotes } from '../generators';
import { resolveCollision } from '../generators';
import { FolderSuggest } from './folder-suggest';
import { PreviewModal } from './preview-modal';
import { debugLog } from '../utils/debug-log';

type InputMode = 'paste' | 'file';

interface ConversationChoice {
	id: string;
	title: string;
	messageCount: number;
}

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
	private availableConversations: ConversationChoice[] = [];
	private selectedConversationId: string | null = null;

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

		const step1Settings = this.contentEl.createDiv('chat-splitter-step1-settings');

		new Setting(step1Settings)
			.setName('Target folder')
			.addText(text => {
				text.setValue(this.importConfig.targetFolder);
				text.onChange(value => { this.importConfig.targetFolder = value; });
				new FolderSuggest(this.app, text.inputEl);
			});

		new Setting(step1Settings)
			.setName('Tag prefix')
			.addText(text => {
				text.setValue(this.importConfig.tagPrefix);
				text.onChange(value => { this.importConfig.tagPrefix = value; });
			});

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

			try {
				if (file.name.endsWith('.zip')) {
					this.rawInput = await this.extractZip(file);
				} else {
					this.rawInput = await file.text();
				}

				this.updateFormatBadge(badge);
				this.checkMultiConversation(badge);

				const btn = this.contentEl.querySelector('.mod-cta') as HTMLButtonElement;
				if (btn) btn.disabled = !this.rawInput.trim();
			} catch (err) {
				fileLabel.setText('Error reading file');
				new Notice(`File read error: ${err instanceof Error ? err.message : String(err)}`);
			}
		});
	}

	private async extractZip(file: File): Promise<string> {
		const buffer = await file.arrayBuffer();
		const zip = await JSZip.loadAsync(buffer);
		const jsonFiles: string[] = [];

		zip.forEach((relativePath: string, entry: JSZip.JSZipObject) => {
			if (!entry.dir && relativePath.endsWith('.json')) {
				jsonFiles.push(relativePath);
			}
		});

		if (jsonFiles.length === 0) {
			throw new Error('No JSON files found in ZIP archive');
		}

		const targetFile = jsonFiles.find(f => f.includes('conversations')) || jsonFiles[0];
		const content = await zip.file(targetFile)?.async('string');
		if (!content) {
			throw new Error(`Could not read ${targetFile} from ZIP archive`);
		}

		return content;
	}

	private checkMultiConversation(badge: HTMLElement): void {
		this.availableConversations = [];
		this.selectedConversationId = null;

		if (!this.detectedFormat || this.detectedFormat.method !== 'file-json') return;
		if (this.detectedFormat.source !== 'chatgpt') return;

		try {
			const conversations = listConversations(this.rawInput);
			if (conversations.length > 1) {
				this.availableConversations = conversations;
				this.renderConversationSelector(badge);
			}
		} catch {
			// Not multi-conversation, continue with single
		}
	}

	private renderConversationSelector(badge: HTMLElement): void {
		const existing = this.contentEl.querySelector('.chat-splitter-conv-selector');
		if (existing) existing.remove();

		const container = this.contentEl.createDiv('chat-splitter-conv-selector');

		const label = container.createEl('label', { text: `${this.availableConversations.length} conversations found. Select one:` });
		label.style.display = 'block';
		label.style.marginBottom = '4px';
		label.style.fontSize = 'var(--font-smaller)';

		const select = container.createEl('select');
		select.style.width = '100%';

		for (const conv of this.availableConversations) {
			const option = select.createEl('option', {
				text: `${conv.title} (${conv.messageCount} nodes)`,
				attr: { value: conv.id },
			});
			if (conv.id === this.selectedConversationId) {
				option.selected = true;
			}
		}

		select.addEventListener('change', () => {
			this.selectedConversationId = select.value;
		});

		const analyzeBtn = this.contentEl.querySelector('.mod-cta');
		if (analyzeBtn) {
			analyzeBtn.before(container);
		}
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

			if (!this.rawInput.trim()) {
				if (errorEl) {
					errorEl.style.display = 'block';
					errorEl.setText('No content to analyze');
				}
				return;
			}

			const parseOptions = this.selectedConversationId
				? { conversationId: this.selectedConversationId }
				: undefined;

			debugLog('Format detected:', this.detectedFormat);
			this.conversation = parseInput(this.rawInput, parseOptions);
			debugLog('Parse result:', this.conversation.messageCount, 'messages,', this.conversation.parseWarnings.length, 'warnings');

			if (this.conversation.parseWarnings.length > 0) {
				debugLog('Parse warnings:', this.conversation.parseWarnings);
			}

			const config = {
				granularity: this.importConfig.granularity,
				method: 'heuristic' as const,
				signalWeights: DEFAULT_SIGNAL_WEIGHTS,
				thresholds: GRANULARITY_PRESETS[this.importConfig.granularity],
			};

			this.segments = segment(this.conversation, config, this.importConfig.tagPrefix);
			debugLog('Segmentation result:', this.segments.length, 'segments');
			for (const seg of this.segments) {
				debugLog(`  Segment: "${seg.title}" (${seg.messages.length} msgs, confidence: ${seg.confidence.toFixed(2)})`);
			}

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
				drop.addOption('plain', 'Plain (no labels)');
				drop.setValue(this.importConfig.speakerStyle);
				drop.onChange(value => {
					this.importConfig.speakerStyle = value as SpeakerStyle;
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

		const previewLink = this.contentEl.createEl('a', {
			text: 'Preview segments...',
			attr: { href: '#', style: 'display: block; margin-top: 8px; font-size: var(--font-smaller);' },
		});
		previewLink.addEventListener('click', (e) => {
			e.preventDefault();
			this.openPreview();
		});

		const buttonContainer = this.contentEl.createDiv('chat-splitter-buttons');

		const backBtn = buttonContainer.createEl('button', { text: 'Back' });
		backBtn.addEventListener('click', () => this.renderStep1());

		const createBtn = buttonContainer.createEl('button', {
			text: `Create ${this.segments.length + 1} Notes`,
			cls: 'mod-cta',
		});
		createBtn.addEventListener('click', () => this.handleCreate());

		if (this.settings.alwaysPreview) {
			this.openPreview();
		}
	}

	private openPreview(): void {
		if (!this.conversation) return;
		new PreviewModal(
			this.app,
			this.segments,
			this.importConfig,
			this.conversation,
			(editedSegments) => {
				this.segments = editedSegments;
				this.handleCreate();
			}
		).open();
	}

	private async reRunSegmentation(): Promise<void> {
		if (!this.conversation) return;

		const config = {
			granularity: this.importConfig.granularity,
			method: (this.importConfig.useOllama ? 'ollama' : 'heuristic') as 'heuristic' | 'ollama',
			signalWeights: DEFAULT_SIGNAL_WEIGHTS,
			thresholds: GRANULARITY_PRESETS[this.importConfig.granularity],
		};

		if (this.importConfig.useOllama && this.settings.enableOllama) {
			const ollamaSettings = {
				endpoint: this.settings.ollamaEndpoint,
				model: this.settings.ollamaModel,
			};
			const result = await segmentWithFallback(
				this.conversation,
				config,
				this.importConfig.tagPrefix,
				ollamaSettings
			);
			this.segments = result.segments;
			if (result.usedFallback) {
				new Notice('Ollama unavailable, using built-in analysis');
			}
		} else {
			this.segments = segment(this.conversation, config, this.importConfig.tagPrefix);
		}

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
			const existingMatch = await this.findExistingConversation(this.conversation.id);
			if (existingMatch) {
				const proceed = await this.promptDuplicateAction(existingMatch);
				if (!proceed) {
					if (createBtn) {
						createBtn.disabled = false;
						createBtn.setText(`Create ${this.segments.length + 1} Notes`);
					}
					return;
				}
			}

			const notes = generateNotes(
				this.conversation,
				this.segments,
				this.importConfig,
				this.settings.customFrontmatter
			);

			debugLog('Generating', notes.length, 'notes');

			for (let i = 0; i < notes.length; i++) {
				if (createBtn) {
					createBtn.setText(`Creating... (${i + 1}/${notes.length})`);
				}

				const note = notes[i];
				const folderPath = note.path.substring(0, note.path.lastIndexOf('/'));

				if (folderPath) {
					await this.ensureFolderExists(folderPath);
				}

				const resolvedPath = resolveCollision(note.path, this.app.vault);
				debugLog('Creating note:', resolvedPath);
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

	private async ensureFolderExists(folderPath: string): Promise<void> {
		if (this.app.vault.getAbstractFileByPath(folderPath)) return;

		const parts = folderPath.split('/');
		let current = '';
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(current)) {
				await this.app.vault.createFolder(current);
			}
		}
	}

	private async findExistingConversation(conversationId: string): Promise<string | null> {
		if (!conversationId) return null;

		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter?.conversation_id === conversationId) {
				return file.path;
			}
		}
		return null;
	}

	private async promptDuplicateAction(existingPath: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new DuplicateModal(this.app, existingPath, (action) => {
				if (action === 'skip') {
					resolve(false);
				} else {
					resolve(true);
				}
			});
			modal.open();
		});
	}
}

class DuplicateModal extends Modal {
	private existingPath: string;
	private onAction: (action: 'skip' | 'import-new') => void;

	constructor(app: App, existingPath: string, onAction: (action: 'skip' | 'import-new') => void) {
		super(app);
		this.existingPath = existingPath;
		this.onAction = onAction;
	}

	onOpen(): void {
		this.contentEl.createEl('h3', { text: 'Duplicate Conversation Found' });
		this.contentEl.createEl('p', {
			text: `A conversation with the same ID already exists at: ${this.existingPath}`,
		});

		const btnContainer = this.contentEl.createDiv('chat-splitter-buttons');

		const skipBtn = btnContainer.createEl('button', { text: 'Cancel Import' });
		skipBtn.addEventListener('click', () => {
			this.onAction('skip');
			this.close();
		});

		const importNewBtn = btnContainer.createEl('button', {
			text: 'Import as New',
			cls: 'mod-cta',
		});
		importNewBtn.addEventListener('click', () => {
			this.onAction('import-new');
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
