export const STOP_WORDS: Set<string> = new Set([
	'a', 'about', 'above', 'after', 'again', 'against', 'all', 'also', 'am', 'an',
	'and', 'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
	'below', 'between', 'both', 'but', 'by', 'can', 'could', 'did', 'do', 'does',
	'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'get',
	'got', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself',
	'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its',
	'itself', 'just', 'know', 'let', 'like', 'make', 'may', 'me', 'might', 'more',
	'most', 'much', 'must', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off',
	'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out',
	'over', 'own', 'per', 'put', 'quite', 're', 'really', 'right', 'said', 'same',
	'say', 'shall', 'she', 'should', 'so', 'some', 'such', 'take', 'than', 'that',
	'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
	'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'upon', 'us',
	'use', 'very', 'want', 'was', 'we', 'well', 'were', 'what', 'when', 'where',
	'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would', 'yes', 'yet',
	'you', 'your', 'yours', 'yourself', 'yourselves',
]);

export function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(/[\s\p{P}]+/u)
		.filter(token => token.length >= 3);
}

export function removeStopWords(tokens: string[]): string[] {
	return tokens.filter(token => !STOP_WORDS.has(token));
}
