import type { Message, Granularity } from '../../types';

const GRANULARITY_INSTRUCTIONS: Record<Granularity, string> = {
	coarse: 'Only split when there is a very clear and major topic change. Prefer fewer, larger segments.',
	medium: 'Split when the conversation moves to a distinctly different topic. Balance between too many and too few segments.',
	fine: 'Split when you detect any meaningful shift in subject matter, even within a broader topic.',
};

export function buildSegmentationPrompt(messages: Message[], granularity: Granularity): string {
	const messageList = messages.map(m => {
		const preview = m.plainText.slice(0, 200).replace(/\n/g, ' ');
		return `[${m.index}] ${m.role}: ${preview}`;
	}).join('\n');

	return `You are analyzing a conversation to identify topic segments. Your goal is to find natural topic boundaries.

GRANULARITY: ${granularity}
${GRANULARITY_INSTRUCTIONS[granularity]}

RULES:
- Only split BEFORE user messages (never in the middle of an assistant response)
- Each segment must contain at least one user message and one assistant message
- Provide a short descriptive title for each segment (max 50 characters)
- Provide a 1-2 sentence summary for each segment
- Assign a confidence score (0.0 to 1.0) for each segment boundary

CONVERSATION:
${messageList}

Respond with ONLY a JSON array. No other text before or after. Format:
[
  {
    "startIndex": <first message index>,
    "endIndex": <last message index>,
    "title": "<topic title>",
    "summary": "<1-2 sentence summary>",
    "confidence": <0.0 to 1.0>
  }
]

Example output for a 2-segment conversation:
[
  {"startIndex": 0, "endIndex": 5, "title": "Project Setup", "summary": "Discussion about initial project configuration.", "confidence": 1.0},
  {"startIndex": 6, "endIndex": 12, "title": "Database Design", "summary": "Planning the database schema and relationships.", "confidence": 0.85}
]`;
}
