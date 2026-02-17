import { PluginSettingTab, Setting, Notice, type App } from 'obsidian';
import type ChatSplitterPlugin from '../main';
import type { SpeakerStyle } from '../types/settings';
import { FolderSuggest } from './folder-suggest';

export class ChatSplitterSettingTab extends PluginSettingTab {
	plugin: ChatSplitterPlugin;

	constructor(app: App, plugin: ChatSplitterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderGeneralSection(containerEl);
		this.renderSegmentationSection(containerEl);
		this.renderFormattingSection(containerEl);
		this.renderAISection(containerEl);
		this.renderAdvancedSection(containerEl);
	}

	private renderGeneralSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'General' });

		new Setting(containerEl)
			.setName('Default folder')
			.setDesc('Default folder for imported conversations')
			.addText(text => {
				text.setValue(this.plugin.settings.defaultFolder);
				text.onChange(async (value) => {
					this.plugin.settings.defaultFolder = value;
					await this.plugin.saveSettings();
				});
				new FolderSuggest(this.app, text.inputEl);
			});

		new Setting(containerEl)
			.setName('Naming template')
			.setDesc('Variables: {{date}}, {{conversation_title}}, {{topic}}, {{source}}, {{segment}}, {{segment_total}}')
			.addText(text => {
				text.setValue(this.plugin.settings.namingTemplate);
				text.onChange(async (value) => {
					this.plugin.settings.namingTemplate = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Tag prefix')
			.setDesc('Prefix for auto-generated tags')
			.addText(text => {
				text.setValue(this.plugin.settings.tagPrefix);
				text.onChange(async (value) => {
					this.plugin.settings.tagPrefix = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Folder structure')
			.setDesc('Nested creates a subfolder per conversation')
			.addDropdown(drop => {
				drop.addOption('nested', 'Nested');
				drop.addOption('flat', 'Flat');
				drop.setValue(this.plugin.settings.folderStructure);
				drop.onChange(async (value) => {
					this.plugin.settings.folderStructure = value as 'nested' | 'flat';
					await this.plugin.saveSettings();
				});
			});
	}

	private renderSegmentationSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Segmentation' });

		new Setting(containerEl)
			.setName('Default granularity')
			.setDesc('How aggressively to split conversations into topics')
			.addDropdown(drop => {
				drop.addOption('coarse', 'Coarse (fewer segments)');
				drop.addOption('medium', 'Medium');
				drop.addOption('fine', 'Fine (more segments)');
				drop.setValue(this.plugin.settings.defaultGranularity);
				drop.onChange(async (value) => {
					this.plugin.settings.defaultGranularity = value as 'coarse' | 'medium' | 'fine';
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Min segment messages')
			.setDesc('Minimum messages per segment')
			.addText(text => {
				text.setValue(String(this.plugin.settings.minSegmentMessages));
				text.onChange(async (value) => {
					const num = parseInt(value, 10);
					if (!isNaN(num) && num >= 1) {
						this.plugin.settings.minSegmentMessages = num;
						await this.plugin.saveSettings();
					}
				});
			});

		new Setting(containerEl)
			.setName('Min segment words')
			.setDesc('Minimum words per segment')
			.addText(text => {
				text.setValue(String(this.plugin.settings.minSegmentWords));
				text.onChange(async (value) => {
					const num = parseInt(value, 10);
					if (!isNaN(num) && num >= 10) {
						this.plugin.settings.minSegmentWords = num;
						await this.plugin.saveSettings();
					}
				});
			});

		new Setting(containerEl)
			.setName('Always preview')
			.setDesc('Automatically open segment preview before creating notes')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.alwaysPreview);
				toggle.onChange(async (value) => {
					this.plugin.settings.alwaysPreview = value;
					await this.plugin.saveSettings();
				});
			});
	}

	private renderFormattingSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Formatting' });

		new Setting(containerEl)
			.setName('Speaker style')
			.setDesc('How to format speaker turns in notes')
			.addDropdown(drop => {
				drop.addOption('document', 'Document');
				drop.addOption('callouts', 'Callouts');
				drop.addOption('blockquotes', 'Blockquotes');
				drop.addOption('bold', 'Bold');
				drop.setValue(this.plugin.settings.speakerStyle);
				drop.onChange(async (value) => {
					this.plugin.settings.speakerStyle = value as SpeakerStyle;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Show timestamps')
			.setDesc('Include message timestamps when available')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.showTimestamps);
				toggle.onChange(async (value) => {
					this.plugin.settings.showTimestamps = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Collapse long messages')
			.setDesc('Make long assistant messages collapsed by default')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.collapseLongMessages);
				toggle.onChange(async (value) => {
					this.plugin.settings.collapseLongMessages = value;
					await this.plugin.saveSettings();
					this.display();
				});
			});

		if (this.plugin.settings.collapseLongMessages) {
			new Setting(containerEl)
				.setName('Collapse threshold')
				.setDesc('Word count above which messages are collapsed')
				.addText(text => {
					text.setValue(String(this.plugin.settings.collapseThreshold));
					text.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 100) {
							this.plugin.settings.collapseThreshold = num;
							await this.plugin.saveSettings();
						}
					});
				});
		}

		new Setting(containerEl)
			.setName('Keep full transcript')
			.setDesc('Also create a single note with the full conversation')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.keepFullTranscript);
				toggle.onChange(async (value) => {
					this.plugin.settings.keepFullTranscript = value;
					await this.plugin.saveSettings();
				});
			});
	}

	private renderAISection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'AI Enhancement' });

		new Setting(containerEl)
			.setName('Enable Ollama')
			.setDesc('Use local Ollama for enhanced segmentation')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.enableOllama);
				toggle.onChange(async (value) => {
					this.plugin.settings.enableOllama = value;
					await this.plugin.saveSettings();
					this.display();
				});
			});

		if (this.plugin.settings.enableOllama) {
			new Setting(containerEl)
				.setName('Ollama endpoint')
				.setDesc('URL of the Ollama API')
				.addText(text => {
					text.setValue(this.plugin.settings.ollamaEndpoint);
					text.onChange(async (value) => {
						this.plugin.settings.ollamaEndpoint = value;
						await this.plugin.saveSettings();
					});
				});

			new Setting(containerEl)
				.setName('Ollama model')
				.setDesc('Model to use for segmentation')
				.addText(text => {
					text.setValue(this.plugin.settings.ollamaModel);
					text.onChange(async (value) => {
						this.plugin.settings.ollamaModel = value;
						await this.plugin.saveSettings();
					});
				});

			new Setting(containerEl)
				.setName('Test connection')
				.setDesc('Verify Ollama is reachable')
				.addButton(button => {
					button.setButtonText('Test');
					button.onClick(async () => {
						try {
							const { requestUrl } = await import('obsidian');
							const response = await requestUrl({
								url: this.plugin.settings.ollamaEndpoint,
								method: 'GET',
								throw: false,
							});
							if (response.status === 200) {
								new Notice('Ollama connection successful');
							} else {
								new Notice(`Ollama returned status ${response.status}`);
							}
						} catch {
							new Notice('Failed to connect to Ollama');
						}
					});
				});
		}
	}

	private renderAdvancedSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Advanced' });

		new Setting(containerEl)
			.setName('Custom frontmatter')
			.setDesc('Additional YAML fields to add to every generated note (one field: value per line)')
			.addTextArea(textarea => {
				textarea.setValue(this.plugin.settings.customFrontmatter);
				textarea.onChange(async (value) => {
					this.plugin.settings.customFrontmatter = value;
					await this.plugin.saveSettings();
				});
				textarea.inputEl.rows = 4;
				textarea.inputEl.cols = 40;
			});

		new Setting(containerEl)
			.setName('Debug logging')
			.setDesc('Enable verbose logging to developer console')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.debugLogging);
				toggle.onChange(async (value) => {
					this.plugin.settings.debugLogging = value;
					await this.plugin.saveSettings();
				});
			});
	}
}
