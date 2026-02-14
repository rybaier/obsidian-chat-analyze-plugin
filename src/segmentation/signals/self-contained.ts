import type { Message } from '../../types';

const MIN_ASSISTANT_WORDS = 300;
const MIN_HEADINGS = 2;
const MIN_LIST_ITEMS = 3;
const MAX_NEXT_USER_WORDS = 100;

export function scoreSelfContained(assistantMessage: Message, nextUserMessage: Message): number {
	if (assistantMessage.role !== 'assistant' || nextUserMessage.role !== 'user') {
		return 0.0;
	}

	const assistantText = assistantMessage.plainText;
	const assistantWordCount = assistantText.split(/\s+/).length;

	if (assistantWordCount < MIN_ASSISTANT_WORDS) return 0.0;

	const headingCount = (assistantText.match(/^#{1,6}\s+/gm) || []).length;
	const listItemCount = (assistantText.match(/^[\s]*[-*+]\s+|^\s*\d+[.)]\s+/gm) || []).length;

	const isStructured = headingCount >= MIN_HEADINGS || listItemCount >= MIN_LIST_ITEMS;
	if (!isStructured) return 0.0;

	const nextUserWordCount = nextUserMessage.plainText.split(/\s+/).length;
	if (nextUserWordCount > MAX_NEXT_USER_WORDS) return 0.0;

	return 1.0;
}
