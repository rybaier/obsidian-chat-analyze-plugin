export interface NoteFrontmatter {
	cssclasses: string[];
	source: string;
	conversation_id: string;
	conversation_title: string;
	segment?: number;
	segment_total?: number;
	topic?: string;
	date: string;
	date_imported: string;
	tags: string[];
	message_count: number;
	prev?: string;
	next?: string;
	parent?: string;
}

export interface NoteLink {
	type: 'prev' | 'next' | 'parent' | 'child';
	target: string;
	display?: string;
}

export interface GeneratedNote {
	path: string;
	filename: string;
	content: string;
	frontmatter: NoteFrontmatter;
	isIndex: boolean;
	segmentId?: string;
}
