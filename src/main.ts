import { Plugin } from 'obsidian';

export default class ChatSplitterPlugin extends Plugin {
	async onload(): Promise<void> {
		console.log('Chat Splitter plugin loaded');
	}

	onunload(): void {
		console.log('Chat Splitter plugin unloaded');
	}
}
