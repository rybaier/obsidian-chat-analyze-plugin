import { AbstractInputSuggest, TFolder, type App } from 'obsidian';

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private textInputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.textInputEl = inputEl;
	}

	getSuggestions(query: string): TFolder[] {
		const lowerQuery = query.toLowerCase();
		const folders: TFolder[] = [];

		for (const file of this.app.vault.getAllLoadedFiles()) {
			if (file instanceof TFolder) {
				if (file.path.toLowerCase().includes(lowerQuery)) {
					folders.push(file);
				}
			}
		}

		return folders.sort((a, b) => a.path.localeCompare(b.path));
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}

	selectSuggestion(folder: TFolder): void {
		this.textInputEl.value = folder.path;
		this.textInputEl.trigger('input');
		this.close();
	}
}
