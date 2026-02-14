import { readFileSync } from 'fs';
import { parseInput } from './src/parsers';

const testFile = readFileSync('./TEST_PASTE_CONVERSATION.md', 'utf-8');
const conversation = parseInput(testFile);

for (const idx of [7, 13]) {
	const m = conversation.messages[idx];
	console.log(`\n--- MSG ${idx} (${m.role}) ---`);
	console.log('First 300 chars:');
	console.log(m.plainText.slice(0, 300));
	console.log('...');
}
