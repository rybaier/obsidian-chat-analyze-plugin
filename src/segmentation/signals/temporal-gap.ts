import type { Message } from '../../types';

const GAP_THRESHOLD_MINUTES = 30;
const MAX_GAP_MINUTES = 120;

export function scoreTemporalGap(messageBefore: Message, messageAfter: Message): number {
	if (!messageBefore.timestamp || !messageAfter.timestamp) return 0.0;

	const gapMs = messageAfter.timestamp.getTime() - messageBefore.timestamp.getTime();
	const gapMinutes = gapMs / (1000 * 60);

	if (gapMinutes < GAP_THRESHOLD_MINUTES) return 0.0;

	return Math.min(1.0, gapMinutes / MAX_GAP_MINUTES);
}
