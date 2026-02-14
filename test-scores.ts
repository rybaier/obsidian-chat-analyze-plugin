import { readFileSync } from 'fs';
import { parseInput } from './src/parsers';
import { scoreBoundaries } from './src/segmentation/scorer';
import { DEFAULT_SIGNAL_WEIGHTS } from './src/segmentation/segmenter';
import { GRANULARITY_PRESETS } from './src/types';

const testFile = readFileSync('./TEST_PASTE_CONVERSATION.md', 'utf-8');
const conversation = parseInput(testFile);

console.log('=== BOUNDARY SCORES (MEDIUM config) ===');
console.log('Messages:', conversation.messageCount);
console.log('');

const config = {
	granularity: 'medium' as const,
	method: 'heuristic' as const,
	signalWeights: DEFAULT_SIGNAL_WEIGHTS,
	thresholds: GRANULARITY_PRESETS['medium'],
};

const boundaries = scoreBoundaries(conversation.messages, config);

console.log('Signal weights:', JSON.stringify(DEFAULT_SIGNAL_WEIGHTS, null, 2));
console.log('');
console.log('Threshold (medium):', config.thresholds.confidenceThreshold);
console.log('');

for (const b of boundaries) {
	const msg = conversation.messages[b.beforeIndex];
	const preview = msg.plainText.slice(0, 80).replace(/\n/g, ' ');
	console.log(`--- Boundary at msg [${b.beforeIndex}]: "${preview}"`);
	console.log(`    Composite score: ${b.score.toFixed(4)} ${b.score >= config.thresholds.confidenceThreshold ? 'ABOVE THRESHOLD' : ''}`);
	for (const s of b.signals) {
		if (s.score > 0) {
			console.log(`      ${s.signal}: raw=${s.score.toFixed(3)} * weight=${s.weight.toFixed(2)} = ${(s.score * s.weight).toFixed(4)}`);
		}
	}
	console.log('');
}
