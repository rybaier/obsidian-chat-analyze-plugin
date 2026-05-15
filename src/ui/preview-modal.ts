import { Modal, type App } from 'obsidian';
import type { ParsedConversation, Segment, ImportConfig } from '../types';
import { mergeSegments, splitSegment, renameSegment } from '../segmentation';

export class PreviewModal extends Modal {
	private segments: Segment[];
	private previousState: Segment[] | null = null;
	private conversation: ParsedConversation;
	private importConfig: ImportConfig;
	private onConfirm: (segments: Segment[]) => void;

	constructor(
		app: App,
		segments: Segment[],
		importConfig: ImportConfig,
		conversation: ParsedConversation,
		onConfirm: (segments: Segment[]) => void
	) {
		super(app);
		this.segments = [...segments];
		this.importConfig = importConfig;
		this.conversation = conversation;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		this.modalEl.addClass('chat-splitter-preview-modal');
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		this.contentEl.empty();

		const header = this.contentEl.createDiv('chat-splitter-step-header');
		const totalMessages = this.segments.reduce((sum, s) => sum + s.messages.length, 0);
		header.createEl('h2', {
			text: `Preview: ${this.segments.length} segments, ${totalMessages} messages`,
		});

		const scrollContainer = this.contentEl.createDiv({
			cls: 'chat-splitter-preview-scroll',
		});

		for (let i = 0; i < this.segments.length; i++) {
			const seg = this.segments[i];

			if (i > 0) {
				const mergeBar = scrollContainer.createDiv({
					cls: 'chat-splitter-merge-bar',
				});
				const mergeBtn = mergeBar.createEl('button', {
					text: 'Merge with above',
					cls: 'chat-splitter-merge-btn',
				});
				mergeBtn.addEventListener('click', () => {
					this.previousState = [...this.segments];
					this.segments = mergeSegments(
						this.segments,
						this.segments[i - 1].id,
						seg.id
					);
					this.render();
				});
			}

			const card = scrollContainer.createDiv('chat-splitter-segment-card');

			const headerRow = card.createDiv('segment-header');

			const titleInput = headerRow.createEl('input', {
				type: 'text',
				value: seg.title,
				cls: 'chat-splitter-segment-title-input',
			});
			titleInput.addEventListener('blur', () => {
				if (titleInput.value !== seg.title) {
					this.segments = renameSegment(this.segments, seg.id, titleInput.value);
				}
			});
			titleInput.addEventListener('keydown', (e: KeyboardEvent) => {
				if (e.key === 'Enter') {
					titleInput.blur();
				}
			});

			headerRow.createSpan({
				text: `${seg.messages.length} msgs`,
				cls: 'chat-splitter-segment-meta',
			});

			const tagsRow = card.createDiv({ cls: 'chat-splitter-tags-row' });
			for (const tag of seg.tags) {
				tagsRow.createSpan({
					text: tag,
					cls: 'chat-splitter-tag-pill',
				});
			}

			const preview = card.createDiv('chat-splitter-segment-preview');
			const previewCount = Math.min(3, seg.messages.length);
			for (let j = 0; j < previewCount; j++) {
				const msg = seg.messages[j];
				const label = msg.role === 'user' ? 'User' : 'Assistant';
				const text = msg.plainText.slice(0, 100);
				const suffix = msg.plainText.length > 100 ? '...' : '';
				preview.createEl('p', {
					text: `${label}: ${text}${suffix}`,
					cls: 'chat-splitter-preview-line',
				});
			}
			if (seg.messages.length > 3) {
				const showAll = preview.createEl('a', {
					text: `Show all ${seg.messages.length} messages`,
					cls: 'chat-splitter-show-all-link',
					attr: { href: '#' },
				});
				showAll.addEventListener('click', (e) => {
					e.preventDefault();
					this.renderExpandedSegment(preview, seg);
				});
			}
		}

		const bottomBar = this.contentEl.createDiv({
			cls: 'chat-splitter-bottom-bar',
		});

		const undoBtn = bottomBar.createEl('button', { text: 'Undo last change' });
		undoBtn.disabled = !this.previousState;
		undoBtn.addEventListener('click', () => {
			if (this.previousState) {
				this.segments = this.previousState;
				this.previousState = null;
				this.render();
			}
		});

		bottomBar.createSpan({ text: `${this.segments.length} segments` });

		const createBtn = bottomBar.createEl('button', {
			text: `Create ${this.segments.length + 1} Notes`,
			cls: 'mod-cta',
		});
		createBtn.addEventListener('click', () => {
			this.onConfirm(this.segments);
			this.close();
		});
	}

	private renderExpandedSegment(container: HTMLElement, seg: Segment): void {
		container.empty();

		for (let j = 0; j < seg.messages.length; j++) {
			const msg = seg.messages[j];
			const label = msg.role === 'user' ? 'User' : 'Assistant';
			const text = msg.plainText.slice(0, 200);
			const suffix = msg.plainText.length > 200 ? '...' : '';

			if (j > 0 && msg.role === 'user') {
				const divider = container.createDiv({
					cls: 'chat-splitter-split-divider',
				});
				divider.createSpan({ text: 'Split at this point' });
				const splitIndex = seg.startIndex + j;
				divider.addEventListener('click', () => {
					this.previousState = [...this.segments];
					this.segments = splitSegment(this.segments, seg.id, splitIndex);
					this.render();
				});
			}

			container.createEl('p', {
				text: `${label}: ${text}${suffix}`,
				cls: 'chat-splitter-preview-line',
			});
		}
	}
}
