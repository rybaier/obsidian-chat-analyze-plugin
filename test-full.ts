import { readFileSync } from 'fs';
import { parseInput } from './src/parsers';
import { segment, DEFAULT_SIGNAL_WEIGHTS } from './src/segmentation/segmenter';
import { GRANULARITY_PRESETS } from './src/types';

const testFile = readFileSync('./TEST_PASTE_CONVERSATION.md', 'utf-8');
const conversation = parseInput(testFile);

console.log('=== PARSED CONVERSATION ===');
console.log(`Title: ${conversation.title}`);
console.log(`Source: ${conversation.source}`);
console.log(`Messages: ${conversation.messageCount}`);
console.log(`Warnings: ${conversation.parseWarnings.length > 0 ? conversation.parseWarnings.join(', ') : 'none'}`);
console.log('');

for (const granularity of ['coarse', 'medium', 'fine'] as const) {
	const config = {
		granularity,
		method: 'heuristic' as const,
		signalWeights: DEFAULT_SIGNAL_WEIGHTS,
		thresholds: GRANULARITY_PRESETS[granularity],
	};

	const segments = segment(conversation, config, 'ai-chat');

	console.log(`=== SEGMENTATION: ${granularity.toUpperCase()} (threshold: ${config.thresholds.confidenceThreshold}) ===`);
	console.log(`Segments: ${segments.length}`);
	console.log('');

	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];
		console.log(`  [${i + 1}] "${seg.title}"`);
		console.log(`      Messages: ${seg.messages.length} (indices ${seg.startIndex}-${seg.endIndex})`);
		console.log(`      Tags: ${seg.tags.join(', ')}`);
		console.log(`      Summary: ${seg.summary.slice(0, 150)}`);
		console.log(`      Confidence: ${seg.confidence.toFixed(3)}`);
		console.log('');

		for (const m of seg.messages) {
			const preview = m.plainText.slice(0, 60).replace(/\n/g, ' ');
			console.log(`        [${m.index}] ${m.role}: "${preview}..."`);
		}
		console.log('');
	}
}
