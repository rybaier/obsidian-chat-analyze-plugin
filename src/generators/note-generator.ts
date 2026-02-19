import type { ParsedConversation, Segment, GeneratedNote, ImportConfig } from '../types';
import { buildFrontmatter } from './frontmatter-builder';
import { formatMessages } from './content-formatter';
import { resolveLinks, renderNavigationFooter } from './link-resolver';
import { sanitizeFilename } from './sanitize';
import { renderTemplate } from '../utils/templates';
import { generateIndexNote } from './index-note-generator';
import { extractKeyInfo, renderKeyInfoBlock } from './key-info-extractor';

export function generateNotes(
	conversation: ParsedConversation,
	segments: Segment[],
	config: ImportConfig,
	customFrontmatter?: string
): GeneratedNote[] {
	const notes: GeneratedNote[] = [];
	const dateStr = formatDate(conversation.createdAt);
	const importedStr = new Date().toISOString();
	const isDocument = conversation.contentType === 'document';
	const segmentCss = isDocument ? 'document-segment' : 'chat-segment';
	const segmentLabel = isDocument ? 'Section' : 'Segment';
	const messagesLabel = isDocument ? 'Sections' : 'Messages';

	const baseVars: Record<string, string> = {
		date: dateStr,
		conversation_title: conversation.title,
		source: conversation.source,
		segment_total: String(segments.length),
	};

	const indexNoteName = sanitizeFilename(
		renderTemplate(config.namingTemplate, { ...baseVars, topic: 'Index' })
	);

	const segLinks = resolveLinks(segments, indexNoteName, config.namingTemplate, baseVars);

	const noteNames: string[] = [];

	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];
		const vars = {
			...baseVars,
			topic: seg.title,
			segment: String(i + 1),
		};
		const filename = sanitizeFilename(renderTemplate(config.namingTemplate, vars));
		noteNames.push(filename);

		const folderPath = config.folderStructure === 'nested'
			? `${config.targetFolder}/${sanitizeFilename(conversation.title)}`
			: config.targetFolder;

		const filePath = `${folderPath}/${filename}.md`;

		const frontmatter = buildFrontmatter({
			cssclasses: [segmentCss],
			source: conversation.source,
			conversation_id: conversation.id,
			conversation_title: conversation.title,
			segment: i + 1,
			segment_total: segments.length,
			topic: seg.title,
			date: dateStr,
			date_imported: importedStr,
			tags: [config.tagPrefix, ...seg.tags],
			message_count: seg.messages.length,
			prev: i > 0 ? `[[${noteNames[i - 1]}]]` : undefined,
			next: undefined,
			parent: `[[${indexNoteName}]]`,
		}, customFrontmatter);

		if (i > 0) {
			const prevNote = notes[notes.length - 1];
			const prevContent = prevNote.content;
			const updatedFm = prevContent.replace(
				/^---\n[\s\S]*?\n---/,
				buildFrontmatter({
					...prevNote.frontmatter,
					next: `[[${filename}]]`,
				}, customFrontmatter)
			);
			notes[notes.length - 1] = { ...prevNote, content: updatedFm, frontmatter: { ...prevNote.frontmatter, next: `[[${filename}]]` } };
		}

		const infoHeader = `# ${seg.title}\n\n> [!info] ${segmentLabel} ${i + 1} of ${segments.length} from [[${indexNoteName}]]\n> **Source:** ${conversation.source} | **Date:** ${dateStr} | **${messagesLabel}:** ${seg.messages.length}`;

		const messageContent = formatMessages(seg.messages, config.speakerStyle, {
			collapseLong: true,
			collapseThreshold: 800,
			showTimestamps: false,
		});

		const navFooter = renderNavigationFooter(segLinks[i]);

		const keyInfo = extractKeyInfo(seg.messages, seg.summary, seg.tags);
		const keyInfoBlock = renderKeyInfoBlock(keyInfo);

		const content = [frontmatter, '', infoHeader, '', keyInfoBlock, '', '---', '', messageContent, '', navFooter].join('\n');

		notes.push({
			path: filePath,
			filename,
			content,
			frontmatter: {
				cssclasses: [segmentCss],
				source: conversation.source,
				conversation_id: conversation.id,
				conversation_title: conversation.title,
				segment: i + 1,
				segment_total: segments.length,
				topic: seg.title,
				date: dateStr,
				date_imported: importedStr,
				tags: [config.tagPrefix, ...seg.tags],
				message_count: seg.messages.length,
				parent: `[[${indexNoteName}]]`,
			},
			isIndex: false,
			segmentId: seg.id,
		});
	}

	if (config.keepFullTranscript) {
		const transcriptNote = generateTranscriptNote(
			conversation, config, indexNoteName, dateStr, importedStr, customFrontmatter
		);
		notes.push(transcriptNote);
	}

	const indexNote = generateIndexNote(
		conversation, segments, noteNames, config, indexNoteName,
		dateStr, importedStr, config.keepFullTranscript, customFrontmatter
	);
	notes.push(indexNote);

	return notes;
}

function generateTranscriptNote(
	conversation: ParsedConversation,
	config: ImportConfig,
	indexNoteName: string,
	dateStr: string,
	importedStr: string,
	customFrontmatter?: string
): GeneratedNote {
	const transcriptCss = conversation.contentType === 'document' ? 'document-transcript' : 'chat-transcript';
	const filename = sanitizeFilename(
		renderTemplate(config.namingTemplate, {
			date: dateStr,
			conversation_title: conversation.title,
			topic: 'Full Transcript',
			source: conversation.source,
		})
	);

	const folderPath = config.folderStructure === 'nested'
		? `${config.targetFolder}/${sanitizeFilename(conversation.title)}`
		: config.targetFolder;

	const fm = buildFrontmatter({
		cssclasses: [transcriptCss],
		source: conversation.source,
		conversation_id: conversation.id,
		conversation_title: conversation.title,
		date: dateStr,
		date_imported: importedStr,
		tags: [config.tagPrefix],
		message_count: conversation.messageCount,
		parent: `[[${indexNoteName}]]`,
	}, customFrontmatter);

	const messageContent = formatMessages(conversation.messages, config.speakerStyle, {
		collapseLong: true,
		collapseThreshold: 800,
		showTimestamps: false,
	});

	const content = [
		fm, '',
		`# ${conversation.title} - Full Transcript`, '',
		`> [!info] Full transcript from [[${indexNoteName}]]`,
		`> **Source:** ${conversation.source} | **Date:** ${dateStr} | **Messages:** ${conversation.messageCount}`, '',
		'---', '',
		messageContent,
	].join('\n');

	return {
		path: `${folderPath}/${filename}.md`,
		filename,
		content,
		frontmatter: {
			cssclasses: [transcriptCss],
			source: conversation.source,
			conversation_id: conversation.id,
			conversation_title: conversation.title,
			date: dateStr,
			date_imported: importedStr,
			tags: [config.tagPrefix],
			message_count: conversation.messageCount,
			parent: `[[${indexNoteName}]]`,
		},
		isIndex: false,
	};
}

function formatDate(date: Date | null): string {
	if (!date) return new Date().toISOString().slice(0, 10);
	return date.toISOString().slice(0, 10);
}
