import type { ParsedConversation, Segment, GeneratedNote, ImportConfig } from '../types';
import { buildFrontmatter } from './frontmatter-builder';
import { sanitizeFilename } from './sanitize';

export function generateIndexNote(
	conversation: ParsedConversation,
	segments: Segment[],
	noteNames: string[],
	config: ImportConfig,
	indexNoteName: string,
	dateStr: string,
	importedStr: string,
	hasTranscript: boolean,
	customFrontmatter?: string
): GeneratedNote {
	const folderPath = config.folderStructure === 'nested'
		? `${config.targetFolder}/${sanitizeFilename(conversation.title)}`
		: config.targetFolder;

	const fm = buildFrontmatter({
		cssclasses: ['chat-index'],
		source: conversation.source,
		conversation_id: conversation.id,
		conversation_title: conversation.title,
		date: dateStr,
		date_imported: importedStr,
		tags: [config.tagPrefix],
		message_count: conversation.messageCount,
	}, customFrontmatter);

	const totalMessages = segments.reduce((sum, s) => sum + s.messages.length, 0);
	const infoHeader = `# ${conversation.title}\n\n> [!info] Import Summary\n> **Source:** ${conversation.source} | **Date:** ${dateStr} | **Topics:** ${segments.length} | **Messages:** ${totalMessages}`;

	const tableHeader = '| # | Topic | Messages | Tags |\n|---|-------|----------|------|\n';
	const tableRows = segments.map((seg, i) => {
		const link = `[[${noteNames[i]}]]`;
		const tags = seg.tags.map(t => `\`${t}\``).join(', ');
		return `| ${i + 1} | ${link} | ${seg.messages.length} | ${tags} |`;
	}).join('\n');

	const summaries = segments.map((seg, i) => {
		return `### ${i + 1}. [[${noteNames[i]}|${seg.title}]]\n${seg.summary}`;
	}).join('\n\n');

	const sections = [
		fm, '',
		infoHeader, '',
		'## Topics', '',
		tableHeader + tableRows, '',
		'## Segment Summaries', '',
		summaries,
	];

	if (hasTranscript) {
		const transcriptName = sanitizeFilename(
			`${dateStr} - ${conversation.title} - Full Transcript`
		);
		sections.push('', '## Full Transcript', '', `[[${transcriptName}]]`);
	}

	const content = sections.join('\n');

	return {
		path: `${folderPath}/${indexNoteName}.md`,
		filename: indexNoteName,
		content,
		frontmatter: {
			cssclasses: ['chat-index'],
			source: conversation.source,
			conversation_id: conversation.id,
			conversation_title: conversation.title,
			date: dateStr,
			date_imported: importedStr,
			tags: [config.tagPrefix],
			message_count: conversation.messageCount,
		},
		isIndex: true,
	};
}
