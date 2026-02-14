import type { Message } from '../types';

interface DomainPattern {
	patterns: RegExp[];
	tag: string;
}

const DOMAIN_PATTERNS: DomainPattern[] = [
	{
		patterns: [/\b(python|javascript|typescript|java|rust|golang|ruby|swift|kotlin|php|csharp|c\+\+)\b/i],
		tag: 'coding',
	},
	{
		patterns: [/\b(python)\b/i],
		tag: 'coding/python',
	},
	{
		patterns: [/\b(javascript|typescript)\b/i],
		tag: 'coding/javascript',
	},
	{
		patterns: [/\b(java)\b/i],
		tag: 'coding/java',
	},
	{
		patterns: [/\b(rust)\b/i],
		tag: 'coding/rust',
	},
	{
		patterns: [/\b(sql|query|schema|table|database|postgres|mysql|sqlite|mongodb)\b/i],
		tag: 'database',
	},
	{
		patterns: [/\b(api|endpoint|http|rest|graphql|webhook|fetch|request)\b/i],
		tag: 'web',
	},
	{
		patterns: [/\b(ui|ux|layout|color|design|figma|wireframe|prototype|css|style)\b/i],
		tag: 'design',
	},
	{
		patterns: [/\b(essay|blog|article|content|writing|draft|edit|proofread)\b/i],
		tag: 'writing',
	},
	{
		patterns: [/\b(function|class|module|import|export|variable|loop|array|object|code|programming|debugging|bug|error)\b/i],
		tag: 'coding',
	},
];

const MAX_TAGS = 5;

export function generateTags(messages: Message[], tagPrefix: string): string[] {
	const allText = messages.map(m => m.plainText).join(' ');
	const matchedTags = new Set<string>();

	const normalizedPrefix = tagPrefix.replace(/\/+$/, '');

	for (const domain of DOMAIN_PATTERNS) {
		if (matchedTags.size >= MAX_TAGS) break;

		for (const pattern of domain.patterns) {
			if (pattern.test(allText)) {
				matchedTags.add(`${normalizedPrefix}/${domain.tag}`);
				break;
			}
		}
	}

	if (matchedTags.size === 0) {
		matchedTags.add(normalizedPrefix);
	}

	return [...matchedTags].slice(0, MAX_TAGS);
}
