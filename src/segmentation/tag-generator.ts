import type { Message } from '../types';

interface DomainPattern {
	patterns: RegExp[];
	tag: string;
	minMatches: number;
}

const DOMAIN_PATTERNS: DomainPattern[] = [
	{
		patterns: [/\b(python|javascript|typescript|java(?!script)\b|rust|golang|ruby|swift|kotlin|php|csharp|c\+\+)\b/i],
		tag: 'coding',
		minMatches: 2,
	},
	{
		patterns: [/\bpython\b/i],
		tag: 'coding/python',
		minMatches: 2,
	},
	{
		patterns: [/\b(javascript|typescript)\b/i],
		tag: 'coding/javascript',
		minMatches: 2,
	},
	{
		patterns: [/\b(sql|postgres|mysql|sqlite|mongodb|database\s+(schema|design|query))\b/i],
		tag: 'database',
		minMatches: 2,
	},
	{
		patterns: [/\b(api\s+(endpoint|call|key)|rest\s*api|graphql|webhook|http\s+(request|response))\b/i],
		tag: 'web',
		minMatches: 2,
	},
	{
		patterns: [/\b(figma|wireframe|prototype|ui\s*\/?\s*ux|user\s+interface|mockup|responsive\s+design)\b/i],
		tag: 'design',
		minMatches: 2,
	},
	{
		patterns: [/\b(essay|blog\s+post|proofread(ing)?|copywriting|thesis|dissertation|write\s+(a|an|my)\s+(blog|article|essay))\b/i],
		tag: 'writing',
		minMatches: 2,
	},
	{
		patterns: [/\b(function\s*\(|class\s+\w+\s*\{|import\s+\{|export\s+(default|const|function)|const\s+\w+\s*=|console\.log|stack\s*trace|compiler|runtime\s+error)\b/i],
		tag: 'coding',
		minMatches: 3,
	},
	{
		patterns: [/\b(real\s*estate|property|mortgage|housing|rent(al)?|landlord|lease|condo|apartment)\b/i],
		tag: 'real-estate',
		minMatches: 2,
	},
	{
		patterns: [/\b(invest(ment|ing)?|portfolio|stock|crypto|dividend|roi|capital\s+gain)\b/i],
		tag: 'finance',
		minMatches: 2,
	},
	{
		patterns: [/\b(citizenship|passport|visa|immigra(tion|te)|residency|green\s*card|work\s*permit)\b/i],
		tag: 'immigration',
		minMatches: 2,
	},
	{
		patterns: [/\b(travel|flight|hotel|airbnb|destination|itinerary|vacation|trip)\b/i],
		tag: 'travel',
		minMatches: 2,
	},
	{
		patterns: [/\b(health(care)?|medical|doctor|hospital|insurance|wellness|therapy)\b/i],
		tag: 'health',
		minMatches: 2,
	},
	{
		patterns: [/\b(machine\s*learning|neural\s*network|deep\s*learning|nlp|transformer|gpt|llm|fine[\s-]*tun(e|ing))\b/i],
		tag: 'ai-ml',
		minMatches: 2,
	},
];

const MAX_TAGS = 5;

export function generateTags(messages: Message[], tagPrefix: string): string[] {
	const allText = messages.map(m => m.plainText).join(' ');
	const matchedTags = new Set<string>();

	const normalizedPrefix = tagPrefix.replace(/\/+$/, '');

	for (const domain of DOMAIN_PATTERNS) {
		if (matchedTags.size >= MAX_TAGS) break;

		let totalMatches = 0;
		for (const pattern of domain.patterns) {
			const globalPattern = new RegExp(pattern.source, 'gi');
			const matches = allText.match(globalPattern);
			if (matches) {
				totalMatches += matches.length;
			}
		}

		if (totalMatches >= domain.minMatches) {
			matchedTags.add(`${normalizedPrefix}/${domain.tag}`);
		}
	}

	if (matchedTags.size === 0) {
		matchedTags.add(normalizedPrefix);
	}

	return [...matchedTags].slice(0, MAX_TAGS);
}
