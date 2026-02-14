# Chat Splitter - Implementation Plan

> **Architecture Reference:** [`ARCHITECTURE.md`](./ARCHITECTURE.md)
> **Status:** Draft - Pending Review & Approval
> **Last Updated:** 2026-02-14

This document breaks down the architecture specification into concrete, executable implementation tasks. Each phase contains specific files to create/modify, what each file must contain, acceptance criteria, and verification steps.

**No implementation should begin until both this plan and ARCHITECTURE.md are approved.**

---

## How to Use This Plan

- Phases are executed sequentially (1 through 11)
- Within each phase, tasks can often be done in order listed
- Each phase ends with a commit + push per CLAUDE.md Rule 8
- Checkboxes track completion status per phase
- "Acceptance Criteria" must all pass before marking a phase complete

---

## Phase 1: Project Scaffolding

**Goal:** A buildable, loadable Obsidian plugin skeleton that does nothing.

### Tasks

- [x] **1.1** Create `manifest.json`
  - `id`: `"chat-splitter"`
  - `name`: `"Chat Splitter"`
  - `version`: `"0.1.0"`
  - `minAppVersion`: `"0.15.0"`
  - `description`: `"Split long AI chat transcripts into organized, topic-specific notes."`
  - `author`: `"Ryan Baier"`
  - `isDesktopOnly`: `false`

- [x] **1.2** Create `package.json`
  - Scripts: `dev` (esbuild watch), `build` (tsc + esbuild production)
  - devDependencies: `@types/node`, `esbuild`, `tslib`, `typescript`, `obsidian`
  - dependencies: `jszip` (for ZIP imports in Phase 9)
  - `"main": "main.js"`

- [x] **1.3** Create `tsconfig.json`
  - Based on obsidian-sample-plugin template
  - `target`: `ES6`, `module`: `ESNext`, `moduleResolution`: `node`
  - `baseUrl`: `"src"` (removed `outDir`/`rootDir` since `noEmit: true`)
  - `strict`: `true`, `noEmit`: `true`
  - `include`: `["src/**/*.ts"]`
  - `types`: `["node"]`

- [x] **1.4** Create `esbuild.config.mjs`
  - Entry: `src/main.ts`, output: `main.js`
  - Externals: `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`
  - Format: `cjs`, platform: `node`
  - Production mode via CLI arg
  - Watch mode for dev

- [x] **1.5** Create `.gitignore`
  - Ignore: `node_modules/`, `main.js`, `*.map`, `data.json`, `.DS_Store`, `.obsidian/`

- [x] **1.6** Create `version-bump.mjs`
  - Script to sync version across `manifest.json` and `package.json`
  - Based on obsidian-sample-plugin template

- [x] **1.7** Create `src/main.ts` (empty skeleton)
  ```typescript
  import { Plugin } from 'obsidian';

  export default class ChatSplitterPlugin extends Plugin {
    async onload(): Promise<void> {
      console.log('Chat Splitter plugin loaded');
    }

    onunload(): void {
      console.log('Chat Splitter plugin unloaded');
    }
  }
  ```

- [x] **1.8** Create `styles.css` (empty, with header comment)

- [x] **1.9** Run `npm install` and verify dependency installation

- [x] **1.10** Run `npm run build` and verify `main.js` is generated

### Files Created
| File | Purpose |
|------|---------|
| `manifest.json` | Obsidian plugin manifest |
| `package.json` | Node project config + dependencies |
| `tsconfig.json` | TypeScript compiler config |
| `esbuild.config.mjs` | Build tool config |
| `.gitignore` | Git ignore rules |
| `version-bump.mjs` | Version sync script |
| `src/main.ts` | Plugin entry point (skeleton) |
| `styles.css` | Plugin styles (empty) |

### Acceptance Criteria
- [x] `npm install` completes without errors
- [x] `npm run build` produces `main.js` in project root
- [ ] Plugin loads in Obsidian dev vault without console errors (requires manual test)
- [ ] Plugin can be enabled/disabled without errors (requires manual test)

### Commit Message title
`feat: scaffold obsidian plugin project structure`

### Commit and Push to Main

---

## Phase 2: Core Types & Interfaces

**Goal:** All TypeScript interfaces defined. No runtime code -- types only.

### Tasks

- [x] **2.1** Create `src/types/conversation.ts`
  - `ChatSource` type: `'chatgpt' | 'claude' | 'markdown'`
  - `InputMethod` type: `'paste' | 'file-json' | 'file-zip' | 'file-markdown'`
  - `SpeakerRole` type: `'user' | 'assistant' | 'system' | 'tool'`
  - `ContentBlock` discriminated union: `TextBlock | CodeBlock | ThinkingBlock | ArtifactBlock | ToolUseBlock | ImageBlock`
  - Each block interface with `type` discriminant and appropriate fields
  - `Attachment` interface: `name`, `mimeType?`, `size?`
  - `Message` interface: `id`, `index`, `role`, `contentBlocks`, `plainText`, `timestamp`, `metadata`
  - `ParsedConversation` interface: `id`, `title` (fallback chain: source title, first user message truncated to 50 chars, "Untitled Chat"), `source`, `inputMethod`, `createdAt`, `updatedAt`, `messages`, `messageCount`, `parseWarnings`, `sourceMetadata`

- [x] **2.2** Create `src/types/segment.ts`
  - `Granularity` type: `'coarse' | 'medium' | 'fine'`
  - `SignalResult` interface: `signal`, `score`, `weight`, `detail?`
  - `SegmentBoundary` interface: `beforeIndex`, `score`, `signals`
  - `Segment` interface: `id`, `title`, `summary`, `tags`, `messages`, `startIndex`, `endIndex`, `confidence`, `method`
  - `SegmentationConfig` interface: `granularity`, `method`, `signalWeights`, `thresholds`
  - `GranularityThresholds` interface: `confidenceThreshold`, `minMessages`, `minWords`
  - `GRANULARITY_PRESETS` constant with coarse/medium/fine threshold values

- [x] **2.3** Create `src/types/generated-note.ts`
  - `GeneratedNote` interface: `path`, `filename`, `content`, `frontmatter`, `isIndex`, `segmentId?`
  - `NoteFrontmatter` interface: all frontmatter fields per ARCHITECTURE.md
  - `NoteLink` interface: `type`, `target`, `display?`

- [x] **2.4** Create `src/types/settings.ts`
  - `ChatSplitterSettings` interface: all settings fields per ARCHITECTURE.md Settings Schema
  - `DEFAULT_SETTINGS` constant with all default values
  - `SpeakerStyle` type: `'callouts' | 'blockquotes' | 'bold'`
  - `FolderStructure` type: `'nested' | 'flat'`

- [x] **2.5** Create `src/types/import-config.ts`
  - `ImportConfig` interface: per-import overrides (targetFolder, tagPrefix, granularity, speakerStyle, keepFullTranscript, useOllama, namingTemplate, folderStructure)

- [x] **2.6** Create `src/types/index.ts`
  - Barrel re-exports from all type files

### Files Created
| File | Purpose |
|------|---------|
| `src/types/conversation.ts` | Chat data model types |
| `src/types/segment.ts` | Segmentation types + presets |
| `src/types/generated-note.ts` | Note generation output types |
| `src/types/settings.ts` | Plugin settings + defaults |
| `src/types/import-config.ts` | Per-import config type |
| `src/types/index.ts` | Barrel exports |

### Acceptance Criteria
- [x] `npm run build` succeeds with no type errors
- [x] All interfaces match ARCHITECTURE.md Core Data Model and Settings Schema sections exactly
- [x] `GRANULARITY_PRESETS` values match ARCHITECTURE.md thresholds (coarse: 0.70/8/500, medium: 0.50/4/200, fine: 0.35/2/80)

### Commit Message title
`feat: define core TypeScript interfaces and type system`

### Commit and Push to Main
---

## Phase 3: Paste Parsers + Format Detection

**Goal:** Parse pasted ChatGPT and Claude conversations into `ParsedConversation`.

### Tasks

- [x] **3.1** Create `src/parsers/parser-interface.ts`
  - `InputFormat` discriminated union type (source + method combinations)
  - `IChatParser` interface: `format`, `canParse(input)`, `parse(input, options?)`
  - `ParseOptions` interface: `conversationId?`, `branchStrategy?`

- [x] **3.2** Create `src/parsers/code-block-guard.ts`
  - `maskCodeBlocks(input: string): { masked: string; blocks: Map<string, string> }`
    - Regex to find all fenced code blocks (triple backtick with optional language tag)
    - Replace each block's content with `__CODE_BLOCK_{n}__` placeholder
    - Return the masked string and a map of placeholder-to-original-content
  - `unmaskCodeBlocks(content: string, blocks: Map<string, string>): string`
    - Restore placeholders back to original code block content
  - Must handle nested backtick counts (``` vs ````)
  - Must handle tilde-fenced code blocks (~~~ delimited) in addition to backtick fences
  - Must handle code blocks at start/end of input
  - Must handle empty code blocks

- [x] **3.3** Create `src/parsers/chatgpt-paste-parser.ts`
  - Implements `IChatParser`
  - `canParse()`: check for `You said:` + `ChatGPT said:` patterns (case-insensitive)
  - Also support variant: `You:` / `ChatGPT:`
  - `parse()`:
    1. Apply code block guard (mask)
    2. Split on speaker label regex: `/^(You said|ChatGPT said|You|ChatGPT)\s*:/im`
    3. Map roles: You -> `user`, ChatGPT -> `assistant`
    4. Filter out any tool-role or system-role messages. Only retain user and assistant messages
    5. Build `Message[]` with sequential IDs, trim content, generate `plainText`
    6. Apply code block guard (unmask)
    7. Filter empty messages, add parse warnings for any
    8. Construct and return `ParsedConversation`

- [x] **3.4** Create `src/parsers/claude-paste-parser.ts`
  - Implements `IChatParser`
  - `canParse()`: check for `Human:` + `Assistant:` or `Claude:` patterns
  - `parse()`: same flow as ChatGPT paste parser with Claude-specific role labels
  - Map roles: Human -> `user`, Assistant/Claude -> `assistant`
  - Filter out any tool-role or system-role messages. Only retain user and assistant messages

- [x] **3.5** Create `src/parsers/markdown-parser.ts`
  - Generic fallback parser
  - `canParse()`: always returns `true` (lowest priority)
  - `parse()`: try to detect any role-prefixed pattern (checked in order):
    - `## User` / `## Assistant` headings
    - `#### You:` / `#### ChatGPT:` headings (common browser extension format)
    - `#### Human:` / `#### Assistant:` headings (extension variant)
    - `**User:**` / `**Assistant:**` bold labels
    - Frontmatter with conversation metadata (title, date, model fields)
    - If no speaker pattern detected, entire input becomes a single message
  - Add parse warning if falling back to single-message mode

- [x] **3.6** Create `src/parsers/format-detector.ts`
  - `detectFormat(input: string): InputFormat`
  - Priority-ordered detection:
    1. JSON structure check (try `JSON.parse`, look for `mapping` or `chat_messages` keys)
    2. ChatGPT paste patterns
    3. Claude paste patterns
    4. Generic markdown (fallback)
  - Returns the `InputFormat` discriminant

- [x] **3.7** Create `src/parsers/index.ts`
  - `getAllParsers(): IChatParser[]` -- returns ordered parser list
  - `parseInput(input: string, options?: ParseOptions): ParsedConversation`
    - Calls `detectFormat()`, finds matching parser, calls `parse()`
    - Throws descriptive error if no parser can handle input
  - Re-exports all parser types

### Files Created
| File | Purpose |
|------|---------|
| `src/parsers/parser-interface.ts` | Parser contract + format types |
| `src/parsers/code-block-guard.ts` | Code block protection utility |
| `src/parsers/chatgpt-paste-parser.ts` | ChatGPT paste text parser |
| `src/parsers/claude-paste-parser.ts` | Claude paste text parser |
| `src/parsers/markdown-parser.ts` | Generic fallback parser |
| `src/parsers/format-detector.ts` | Auto-detection logic |
| `src/parsers/index.ts` | Registry + barrel exports |

### Acceptance Criteria
- [x] `npm run build` succeeds
- [x] ChatGPT paste parser correctly parses a sample ChatGPT conversation with "You said:" / "ChatGPT said:" format
- [x] Claude paste parser correctly parses a sample Claude conversation with "Human:" / "Assistant:" format
- [x] Code block guard prevents speaker labels inside code fences from being treated as message boundaries
- [x] Format detection correctly identifies ChatGPT paste, Claude paste, and generic markdown
- [x] Generic parser handles input with no recognizable speaker labels (single-message fallback)
- [x] All parsers produce valid `ParsedConversation` objects with correct `messageCount` and sequential message indices

### Commit Message title
`feat: implement paste parsers with format auto-detection`

### Commit and Push to Main
---

## Phase 4: Heuristic Segmentation Engine

**Goal:** Split a `ParsedConversation` into topic-based `Segment[]` using 6 weighted signals.

**Signal weights:** Signal weights are constant across all granularity levels. Granularity is controlled exclusively through the confidence threshold and minimum segment size.

**Language support:** Segmentation is optimized for English. The domain shift, vocabulary shift, temporal gap, and self-contained signals are language-agnostic. The transition phrases and reintroduction signals use English-only patterns and will score 0.0 for non-English input, resulting in degraded but functional segmentation.

### Tasks

- [x] **4.1** Create `src/utils/stop-words.ts`
  - Export `STOP_WORDS: Set<string>` containing common English stop words (~150 words)
  - Export `removeStopWords(tokens: string[]): string[]`
  - Export `tokenize(text: string): string[]` -- lowercase, split on whitespace/punctuation, filter tokens <3 chars

- [x] **4.2** Create `src/segmentation/signals/transition-phrases.ts`
  - Export `scoreTransitionPhrases(message: Message): number` (returns 0-1)
  - Regex patterns against first 200 chars of user message `plainText`:
    - Strong (1.0): `/^(let'?s|can we|i want to)\s+(move on|switch|change|talk about|discuss)/i`, `/^(on a different|new)\s+(note|topic|subject)/i`, `/^(switching|changing|moving)\s+(to|on to)/i`
    - Moderate (0.5): `/^(now|next|also|another)/i` at sentence start followed by a question
  - Only applies to user-role messages; returns 0.0 for non-user messages

- [x] **4.3** Create `src/segmentation/signals/domain-shift.ts`
  - Export `scoreDomainShift(messages: Message[], boundaryIndex: number, windowSize: number): number`
  - Extract domain tokens (non-stop-word, >2 chars) from messages in window before and after boundary
  - Compute Jaccard similarity: `|intersection| / |union|`
  - Return `1.0 - similarity`
  - Return 0.0 if either window has <5 domain tokens

- [x] **4.4** Create `src/segmentation/signals/vocabulary-shift.ts`
  - Export `scoreVocabularyShift(messages: Message[], boundaryIndex: number, windowSize: number): number`
  - Build term-frequency vectors for before/after windows
  - Compute cosine similarity between TF vectors
  - Return `1.0 - similarity`
  - Return 0.0 if either window is empty

- [x] **4.5** Create `src/segmentation/signals/temporal-gap.ts`
  - Export `scoreTemporalGap(messageBefore: Message, messageAfter: Message): number`
  - If either message lacks a timestamp, return 0.0
  - Compute gap in minutes between consecutive messages
  - Return `min(1.0, gap_minutes / 120)` -- linear scale, maxes at 2 hours
  - Threshold: gaps <30 minutes score 0.0

- [x] **4.6** Create `src/segmentation/signals/self-contained.ts`
  - Export `scoreSelfContained(assistantMessage: Message, nextUserMessage: Message): number`
  - Check assistant message: word count >500 AND (2+ headings OR 5+ list items in `plainText`)
  - Check next user message: word count <100 (suggests new topic, not follow-up)
  - Return 1.0 if both conditions met, 0.0 otherwise

- [x] **4.7** Create `src/segmentation/signals/reintroduction.ts`
  - Export `scoreReintroduction(message: Message): number`
  - Regex patterns against user message `plainText`:
    - Strong (1.0): `/^(i have a question|can you help|i need help|could you explain|what('?s| is| are))\b/i`
    - Moderate (0.5): `/^(how (do|can|should)|why (do|does|is)|is (it|there)|tell me about)\b/i`
  - Only applies to user-role messages

- [x] **4.8** Create `src/segmentation/scorer.ts`
  - `ScoredBoundary` interface (or import from types)
  - Export `scoreBoundaries(messages: Message[], config: SegmentationConfig): ScoredBoundary[]`
  - For each user message boundary (index where `messages[i].role === 'user'` and `i > 0`):
    1. Call each signal function
    2. Multiply raw score by configured weight
    3. Sum for composite score
    4. Collect into `ScoredBoundary` with signal details

- [x] **4.9** Create `src/segmentation/title-generator.ts`
  - Export `generateTitle(messages: Message[]): string`
  - Algorithm:
    1. Find first user message in segment
    2. Take first sentence (up to 80 chars)
    3. If it's a question, clean it (remove "Can you", "Please", leading filler)
    4. Extract top 3 non-stop-word tokens by frequency as fallback
    5. Title case the result, cap at 50 characters

- [x] **4.10** Create `src/segmentation/tag-generator.ts`
  - Export `generateTags(messages: Message[], tagPrefix: string): string[]`
  - Predefined domain patterns (regex to tag mapping):
    - Code terms -> `coding`
    - Language-specific (python, javascript, typescript, etc.) -> `coding/{lang}`
    - Database terms (sql, query, schema, table) -> `database`
    - API/web terms (api, endpoint, http, rest) -> `web`
    - Design terms (ui, ux, layout, color) -> `design`
    - Writing terms (essay, blog, article, content) -> `writing`
  - Scan all messages' `plainText` for matches
  - Trim any trailing slash from tagPrefix before appending `/` -- prevents double-slash in generated tags
  - Prefix with `tagPrefix/`, max 5 tags per segment

- [x] **4.11** Create `src/segmentation/segmenter.ts`
  - Export `segment(conversation: ParsedConversation, config: SegmentationConfig): Segment[]`
  - Algorithm:
    1. Call `scoreBoundaries()` to score all candidate boundaries
    2. Sort by composite score descending
    3. Filter: remove candidates below `config.thresholds.confidenceThreshold`
    4. Greedy select: iterate sorted boundaries, accept if resulting segments all meet minimum size
    5. Sort accepted boundaries chronologically
    6. Construct `Segment[]` from boundary positions
    7. Set segment.confidence to the composite score of the boundary that starts the segment. For the first segment (no preceding boundary), set confidence to 1.0
    8. For each segment: call `generateTitle()` and `generateTags()`
    9. Generate short summary (first user question + first sentence of first assistant response)
  - Handle edge cases:
    - <2 messages: return single segment
    - No boundaries above threshold: return single segment
    - All user messages: return single segment

- [x] **4.12** Create `src/segmentation/segment-utils.ts`
  - Export `mergeSegments(segments: Segment[], idA: string, idB: string): Segment[]`
    - Combine two adjacent segments, recalculate title/tags/summary
  - Export `splitSegment(segments: Segment[], segmentId: string, atMessageIndex: number): Segment[]`
    - Split one segment at a message boundary, generate new titles
  - Export `renameSegment(segments: Segment[], segmentId: string, newTitle: string): Segment[]`
    - Update title of a specific segment

- [x] **4.13** Create `src/segmentation/index.ts`
  - Barrel re-exports: `segment`, `mergeSegments`, `splitSegment`, `renameSegment`, signal functions

### Files Created
| File | Purpose |
|------|---------|
| `src/utils/stop-words.ts` | Stop word list + tokenizer |
| `src/segmentation/signals/transition-phrases.ts` | Signal 1 |
| `src/segmentation/signals/domain-shift.ts` | Signal 2 |
| `src/segmentation/signals/vocabulary-shift.ts` | Signal 3 |
| `src/segmentation/signals/temporal-gap.ts` | Signal 4 |
| `src/segmentation/signals/self-contained.ts` | Signal 5 |
| `src/segmentation/signals/reintroduction.ts` | Signal 6 |
| `src/segmentation/scorer.ts` | Composite boundary scorer |
| `src/segmentation/title-generator.ts` | Auto title extraction |
| `src/segmentation/tag-generator.ts` | Auto tag generation |
| `src/segmentation/segmenter.ts` | Orchestrator |
| `src/segmentation/segment-utils.ts` | Merge/split/rename helpers |
| `src/segmentation/index.ts` | Barrel exports |

### Acceptance Criteria
- [x] `npm run build` succeeds
- [x] Segmenter produces valid `Segment[]` where:
  - All messages are accounted for (no gaps, no duplicates)
  - `startIndex` and `endIndex` are contiguous across segments
  - Each segment has at least `minMessages` messages
  - Each segment has a non-empty title and at least one tag
- [x] Different granularity levels produce different segment counts for a multi-topic conversation
- [x] Single-topic conversation returns exactly 1 segment
- [x] Conversations with <2 messages return 1 segment without error
- [x] `mergeSegments` correctly combines adjacent segments
- [x] `splitSegment` correctly creates two segments at specified boundary

### Commit Message title
`feat: implement heuristic segmentation engine with 6 weighted signals`

### Commit and Push to Main
---

## Phase 5: Note Generation Pipeline

**Goal:** Convert `Segment[]` into ready-to-write Obsidian Markdown notes.

### Tasks

- [ ] **5.1** Create `src/generators/sanitize.ts`
  - Export `sanitizeFilename(name: string): string`
    - Replace `/\:*?"<>|` with `-`
    - Collapse multiple spaces/dashes
    - Trim to 200 characters
    - Trim leading/trailing whitespace and dots
  - Export `resolveCollision(path: string, vault: Vault): string`
    - Check if path exists via `vault.getAbstractFileByPath()`
    - If collision: append ` (2)`, ` (3)`, etc. before `.md`
    - Return the first non-colliding path

- [ ] **5.2** Create `src/utils/templates.ts`
  - Export `renderTemplate(template: string, variables: Record<string, string>): string`
  - Replace `{{varName}}` with corresponding value
  - Available variables: `date`, `conversation_title`, `topic`, `source`, `segment`, `segment_total`
  - Unknown variables left as-is with a console warning if debug logging enabled

- [ ] **5.3** Create `src/generators/frontmatter-builder.ts`
  - Export `buildFrontmatter(data: NoteFrontmatter): string`
  - Produce valid YAML between `---` delimiters
  - Properly escape string values containing colons or special characters
  - Format dates as `YYYY-MM-DD` and datetimes as ISO 8601
  - Wikilinks in frontmatter rendered as quoted strings: `"[[Note Name]]"`
  - Arrays rendered in YAML flow style for tags: `[tag1, tag2]`
  - Merge custom frontmatter fields from settings (validate as valid YAML before merging; skip invalid fields with a warning)

- [ ] **5.4** Create `src/generators/content-formatter.ts`
  - Export `formatMessages(messages: Message[], style: SpeakerStyle, options: { collapseLong: boolean; collapseThreshold: number; showTimestamps: boolean }): string`
  - **Callout style:**
    - User: `> [!user] User\n> content`
    - Assistant: `> [!assistant] Assistant\n> content`
    - Messages over threshold: `> [!assistant]- Assistant\n> content` (collapsed by default)
    - Thinking blocks: `> [!thinking]- Thinking\n> content` (always collapsed)
    - Code blocks within messages: preserve with language tags
  - **Blockquote style:**
    - `**User:**\n> content`
  - **Bold style:**
    - `**User:** content`
  - All styles: handle multi-line content properly (prefix each line with `> ` for callouts/blockquotes)
  - Handle ALL ContentBlock types:
    - `TextBlock`: Rendered inline as markdown text
    - `CodeBlock`: Rendered as fenced code blocks with language tag preserved
    - `ThinkingBlock`: Rendered as collapsed callout: `> [!thinking]- Thinking` (always collapsed)
    - `ArtifactBlock`: Rendered as callout: `> [!note] Artifact: {title}` with content inside
    - `ToolUseBlock`: Stripped during parsing (not rendered)
    - `ImageBlock`: Rendered as `![{altText}]({url})` if URL available, or `[Image: {altText}]` placeholder
  - Role rendering:
    - `user` and `assistant`: Rendered with configured speaker style
    - `system` messages: Filtered out of note output
    - `tool` messages: Filtered out during parsing

- [ ] **5.5** Create `src/generators/link-resolver.ts`
  - Export `resolveLinks(segments: Segment[], indexNoteName: string, namingTemplate: string, variables: Record<string, string>): NoteLink[][]`
  - For each segment, compute: prev link (null for first), next link (null for last), parent link (always index note)
  - Export `renderNavigationFooter(links: NoteLink[]): string`
  - Produces the navigation callout block at bottom of each note
  - Footer format:
    ```
    ---
    > [!info] Navigation
    > Previous: [[Prev Note]] | [[Index Note|Back to Index]] | Next: [[Next Note]]
    ```

- [ ] **5.6** Create `src/generators/note-generator.ts`
  - Export `generateNotes(conversation: ParsedConversation, segments: Segment[], config: ImportConfig): GeneratedNote[]`
  - Orchestration:
    1. Compute base folder path from config (nested vs flat)
    2. For each segment:
       a. Render filename from naming template
       b. Sanitize filename
       c. Build frontmatter
       d. Format message content
       e. Add info header callout (segment X of Y, source, date, message count)
       f. Add navigation footer
       g. Assemble full markdown string
    3. If `keepFullTranscript`: generate a transcript note:
       - Filename: `{{date}} - {{conversation_title}} - Full Transcript`
       - Same folder as segment notes
       - Frontmatter: `cssclasses: [chat-transcript]`, no segment/prev/next fields, parent links to index
       - Content: all messages formatted with configured speaker style, no segment headers or navigation
       - Index note should link to this note in a "Full Transcript" section
    4. Return `GeneratedNote[]`

- [ ] **5.7** Create `src/generators/index-note-generator.ts`
  - Export `generateIndexNote(conversation: ParsedConversation, segments: Segment[], noteNames: string[], config: ImportConfig): GeneratedNote`
  - Produces the MOC note per ARCHITECTURE.md specification:
    - Frontmatter with `cssclasses: [chat-index]`, metadata
    - Title heading
    - Info callout with import summary
    - Topics table: segment number, wikilink, message count, tags
    - Segment summaries section with wikilinks and 1-2 line descriptions

- [ ] **5.8** Create `src/generators/index.ts`
  - Barrel re-exports for all generator functions

### Files Created
| File | Purpose |
|------|---------|
| `src/generators/sanitize.ts` | Filename sanitization + collision resolution |
| `src/utils/templates.ts` | Template variable rendering |
| `src/generators/frontmatter-builder.ts` | YAML frontmatter generation |
| `src/generators/content-formatter.ts` | Message formatting (callouts/blockquotes/bold) |
| `src/generators/link-resolver.ts` | Wikilink navigation |
| `src/generators/note-generator.ts` | Orchestrator: segment to note |
| `src/generators/index-note-generator.ts` | Index/MOC note generation |
| `src/generators/index.ts` | Barrel exports |

### Acceptance Criteria
- [ ] `npm run build` succeeds
- [ ] Generated notes contain valid YAML frontmatter (parseable by Obsidian)
- [ ] Callout formatting produces valid Obsidian callout syntax
- [ ] Long messages (>threshold) use collapsed callout syntax
- [ ] Navigation footer links use correct wikilink syntax: `[[Note Name]]`
- [ ] Index note contains a table with wikilinks to all segment notes
- [ ] Filename sanitization removes all invalid characters
- [ ] Collision resolution appends correct numeric suffix
- [ ] Template rendering replaces all supported variables correctly

### Commit Message title
`feat: implement note generation pipeline with frontmatter and formatting`

### Commit and Push to Main
---

## Phase 6: Import Modal UI + Plugin Wiring

**Goal:** Fully functional import modal with both paste and file input, configuration, and note creation. Plugin commands and ribbon icon registered.

**Dependencies:** Phases 3, 4, 5

### Tasks

- [ ] **6.1** Create `src/ui/folder-suggest.ts`
  - `FolderSuggest extends AbstractInputSuggest<TFolder>`
  - `getSuggestions()`: query `vault.getAllLoadedFiles()`, filter to `TFolder` instances, match against input
  - `renderSuggestion()`: display folder path
  - `selectSuggestion()`: fill input with selected path

- [ ] **6.2** Create `src/ui/import-modal.ts`
  - `ImportModal extends Modal`
  - Constructor: receives `app`, `plugin` (for settings), `mode` (`'paste' | 'file'`)
  - **Internal state:**
    - `step: 1 | 2` -- current wizard step
    - `rawInput: string` -- pasted text or file content
    - `conversation: ParsedConversation | null` -- parsed result
    - `segments: Segment[]` -- segmentation result
    - `importConfig: ImportConfig` -- initialized from plugin settings
    - `detectedFormat: InputFormat | null`
  - **Step 1 render (paste mode):**
    - Tab toggle: Paste | File (switches mode)
    - Textarea element with placeholder, monospace font
    - Format detection badge (updates on input with 300ms debounce)
    - "Analyze" button (disabled until input + format detected)
  - **Step 1 render (file mode):**
    - Hidden `<input type="file" accept=".json,.zip,.md">`
    - "Choose File" button
    - Selected filename display
    - "Analyze" button
  - **Step 1 "Analyze" handler:**
    - Show progress indicator
    - Call `parseInput()` on raw content
    - Call `segment()` with default config
    - Transition to Step 2
    - Handle errors: show inline error message
  - **Step 2 render:**
    - Summary card: "Found X topics in Y messages"
    - Setting rows (using Obsidian `Setting` class):
      - Target folder (with `FolderSuggest`)
      - Tag prefix (text)
      - Granularity (dropdown -- re-runs segmentation on change; if user has made manual segment edits via preview, show confirmation before re-segmenting since edits will be discarded)
      - Speaker style (dropdown)
      - Keep transcript (toggle)
      - Use Ollama (toggle, hidden if not enabled in settings)
    - "Create N Notes" button (CTA)
    - "Preview segments..." link (opens PreviewModal)
    - "Back" button (returns to Step 1)
  - **Step 2 "Create" handler:**
    - Call `generateNotes()` and `generateIndexNote()`
    - Create target folder if missing: `vault.createFolder()`
    - Resolve filename collisions
    - Write each note: `vault.create(path, content)`
    - Show progress: "Creating... (3/7)"
    - On success: close modal, show `Notice`, open index note

- [ ] **6.3** Update `styles.css`
  - `.chat-splitter-import-modal` -- modal width (600px), max-height
  - `.chat-splitter-textarea` -- full width, min-height 300px, monospace
  - `.chat-splitter-format-badge` -- small pill indicator (green/orange/gray)
  - `.chat-splitter-summary-card` -- summary stats block
  - `.chat-splitter-progress` -- progress bar styling
  - `.chat-splitter-error` -- red-tinted error message
  - `.chat-splitter-step-header` -- step indicator styling
  - Custom callout type definitions for rendered notes:
    - `[!user]` callout styling
    - `[!assistant]` callout styling
    - `[!thinking]` callout styling
    - `[!artifact]` callout styling

- [ ] **6.4** Update `src/main.ts`
  - Add settings loading: `loadSettings()` / `saveSettings()` methods
  - Register command: `import-paste` -- "Chat Splitter: Import from clipboard"
  - Register command: `import-file` -- "Chat Splitter: Import from file"
  - Register ribbon icon: scissors icon, opens paste modal
  - Add settings property to plugin class

### Files Created/Modified
| File | Action | Purpose |
|------|--------|---------|
| `src/ui/folder-suggest.ts` | Create | Folder autocomplete |
| `src/ui/import-modal.ts` | Create | Main import wizard |
| `styles.css` | Modify | Modal + callout styles |
| `src/main.ts` | Modify | Commands, ribbon, settings loading |

### Acceptance Criteria
- [ ] Plugin shows ribbon icon that opens import modal
- [ ] Both commands appear in command palette
- [ ] Paste mode: pasting text triggers format detection badge update
- [ ] Paste mode: clicking Analyze parses and segments, shows Step 2
- [ ] File mode: file picker opens, selecting a file loads content
- [ ] Step 2: all per-import settings render and are interactive
- [ ] Step 2: changing granularity re-runs segmentation and updates summary
- [ ] Step 2: "Create Notes" creates notes in vault, shows progress, opens index note
- [ ] Folder suggest autocomplete works in target folder input
- [ ] Error states handled: empty input, parse failure, vault write failure
- [ ] Modal can be closed at any step without side effects

### Commit Message title
`feat: implement import modal UI with paste and file input modes`

### Commit and Push to Main
---

## Phase 7: Preview Modal UI

**Goal:** Opt-in segment preview and editing before note creation.

**Dependencies:** Phase 6

### Tasks

- [ ] **7.1** Create `src/ui/preview-modal.ts`
  - `PreviewModal extends Modal`
  - Constructor: receives `app`, `segments: Segment[]`, `importConfig: ImportConfig`, `conversation: ParsedConversation`, and a callback `onConfirm: (segments: Segment[]) => void`
  - **Internal state:**
    - `segments: Segment[]` -- mutable copy for editing
    - `previousState: Segment[] | null` -- for single-level undo
  - **Render:**
    - Header: segment count + message count
    - Scrollable container with segment cards
    - Each segment card:
      - Editable title (text input, saves on blur/Enter via `renameSegment`)
      - Message count + confidence badge
      - Auto-generated tags displayed as pills
      - Expandable message preview (first 3 messages shown, "Show all N messages" toggle)
      - Messages rendered in compact form: role label + first 100 chars
    - Between-card controls:
      - "Merge with above" button on all except first card
      - "Split here" link that expands into message-level boundary picker
    - Bottom bar:
      - "Undo last change" button (disabled if no previous state)
      - Segment count summary
      - "Create Notes" button (CTA) -- calls `onConfirm(this.segments)` and closes
  - **Split interaction:**
    - Clicking "Split here" on a segment expands it to show all messages
    - Each message boundary shows a clickable "Split at this point" divider
    - Clicking a divider calls `splitSegment()`, re-renders
  - **Merge interaction:**
    - "Merge with above" calls `mergeSegments()`, re-renders
    - Stores pre-merge state for undo

- [ ] **7.2** Update `styles.css` (append)
  - `.chat-splitter-preview-modal` -- wider modal (700px)
  - `.chat-splitter-segment-card` -- bordered card with padding
  - `.chat-splitter-segment-title-input` -- inline editable title
  - `.chat-splitter-segment-meta` -- message count + confidence
  - `.chat-splitter-tag-pill` -- small rounded tag display
  - `.chat-splitter-message-preview` -- compact message display
  - `.chat-splitter-split-divider` -- clickable boundary indicator
  - `.chat-splitter-merge-btn` -- merge button between cards
  - `.chat-splitter-bottom-bar` -- sticky bottom with actions

- [ ] **7.3** Update `src/ui/import-modal.ts`
  - Wire "Preview segments..." link in Step 2 to open `PreviewModal`
  - Pass current segments and import config
  - Handle `onConfirm` callback: receive edited segments, proceed to note creation
  - If `alwaysPreview` setting is true, automatically open preview instead of showing Step 2 create button

### Files Created/Modified
| File | Action | Purpose |
|------|--------|---------|
| `src/ui/preview-modal.ts` | Create | Segment preview/edit modal |
| `styles.css` | Modify | Preview modal styles |
| `src/ui/import-modal.ts` | Modify | Wire preview modal integration |

### Acceptance Criteria
- [ ] Preview modal opens from import modal with correct segments
- [ ] Segment titles are editable inline (saves on blur)
- [ ] Merge combines two adjacent segments, updates display, title defaults to first segment
- [ ] Split opens message-level boundary picker, clicking creates two new segments
- [ ] Undo reverts the last merge/split operation
- [ ] "Create Notes" triggers note creation with the edited segments
- [ ] Closing preview without creating returns to import modal
- [ ] All segments remain contiguous after merge/split (no gaps/duplicates)
- [ ] `alwaysPreview` setting correctly routes to preview modal automatically

### Commit Message title
`feat: implement preview modal with segment merge, split, and rename`

### Commit and Push to Main
---

## Phase 8: Settings Tab

**Goal:** Full settings UI for all plugin configuration.

**Dependencies:** Phase 6

### Tasks

- [ ] **8.1** Create `src/ui/settings-tab.ts`
  - `ChatSplitterSettingTab extends PluginSettingTab`
  - `display()` method builds all settings organized into 5 sections per ARCHITECTURE.md:
  - **Section 1: General**
    - Default folder (text + FolderSuggest)
    - Naming template (text with variable hint in description)
    - Tag prefix (text)
    - Folder structure (dropdown: Nested / Flat)
  - **Section 2: Segmentation**
    - Default granularity (dropdown: Coarse / Medium / Fine)
    - Min segment messages (text with number validation, min 1)
    - Min segment words (text with number validation, min 10)
    - Always preview (toggle)
  - **Section 3: Formatting**
    - Speaker style (dropdown: Callouts / Blockquotes / Bold)
    - Show timestamps (toggle)
    - Collapse long messages (toggle)
    - Collapse threshold (text with number validation, only shown when collapse enabled)
    - Keep full transcript (toggle)
  - **Section 4: AI Enhancement**
    - Enable Ollama (toggle)
    - Ollama endpoint (text, only shown when enabled)
    - Ollama model (dropdown, auto-populated from listModels() when Ollama is enabled and reachable; falls back to text input if model list unavailable; only shown when enabled)
    - Test connection (button, only shown when enabled)
  - **Section 5: Advanced**
    - Custom frontmatter (textarea for additional YAML; validate as valid YAML on save; show inline error if invalid YAML syntax)
    - Debug logging (toggle)
  - Each setting's `onChange` calls `plugin.saveSettings()`
  - Conditional visibility: Ollama settings hidden when toggle off, collapse threshold hidden when collapse off

- [ ] **8.2** Update `src/main.ts`
  - Register settings tab: `this.addSettingTab(new ChatSplitterSettingTab(this.app, this))`

### Files Created/Modified
| File | Action | Purpose |
|------|--------|---------|
| `src/ui/settings-tab.ts` | Create | Plugin settings UI |
| `src/main.ts` | Modify | Register settings tab |

### Acceptance Criteria
- [ ] Settings tab appears under plugin settings in Obsidian
- [ ] All 5 sections render with correct settings per ARCHITECTURE.md
- [ ] All settings persist after changing and reloading Obsidian
- [ ] Conditional visibility works: Ollama fields hide when toggle off
- [ ] Number inputs validate (reject non-numeric, enforce minimums)
- [ ] Folder suggest works in default folder input
- [ ] Test connection button shows success/failure Notice

### Commit Message title
`feat: implement settings tab with all configuration options`

### Commit and Push to Main
---

## Phase 9: JSON File Parsers (ChatGPT + Claude)

**Goal:** Parse ChatGPT and Claude data export files (JSON and ZIP).

**Dependencies:** Phase 3

### Tasks

- [ ] **9.1** Create `src/parsers/chatgpt-json-parser.ts`
  - Implements `IChatParser`
  - `canParse()`: check for array with objects containing `mapping` key, or single object with `mapping`
  - `parse()`:
    1. Parse JSON
    2. If array (multi-conversation export): use `options.conversationId` to select, or first if not specified
    3. Extract `title`, `create_time`, `update_time`
    4. Tree traversal using `current_node` strategy:
       - Walk backward via `parent` pointers to root
       - Reverse for chronological order
       - Alternative (`longest` path strategy): deferred to post-v1.0
       - Skip nodes where `message` is null
       - Skip nodes where `message.content.parts` is empty
       - Add parse warnings for skipped nodes
    5. Filter out messages where `author.role` is `tool` or `system` -- only retain `user` and `assistant` messages
    6. Map `author.role` to `SpeakerRole`
    7. Handle `content_type` variations:
       - `text`: standard TextBlock
       - `code`: CodeBlock with language extraction
       - `execution_output`: TextBlock with code-output styling
       - `multimodal_text`: extract text parts, ImageBlock for image parts
       - `tether_browsing_display_result`: TextBlock with source attribution
    8. Extract timestamps from `message.create_time`
    9. Build `ParsedConversation`
  - Export `listConversations(json: string): Array<{ id: string; title: string; messageCount: number }>` for multi-conversation file selection UI

- [ ] **9.2** Create `src/parsers/claude-json-parser.ts`
  - Implements `IChatParser`
  - `canParse()`: check for `chat_messages` array with objects containing `sender` field
  - `parse()`:
    1. Parse JSON
    2. Handle two structures: direct `chat_messages` array or nested under `conversations`
    3. Filter out messages where `sender` is not `human` or `assistant`
    4. For each message:
       - Map `sender` ("human" -> user, "assistant" -> assistant)
       - Extract `text` field as TextBlock
       - If `content` array exists (newer format): parse into ContentBlocks
       - Extract `created_at` as timestamp
       - Handle `attachments` array
    5. Build `ParsedConversation`

- [ ] **9.3** Update `src/parsers/format-detector.ts`
  - Add JSON structure detection (already stubbed in Phase 3):
    - `mapping` key -> ChatGPT JSON
    - `chat_messages` key -> Claude JSON
  - Ensure JSON detection takes priority over paste detection

- [ ] **9.4** Update `src/parsers/index.ts`
  - Register new parsers in the parser list
  - Ensure priority order: ChatGPT JSON > Claude JSON > ChatGPT paste > Claude paste > Generic

- [ ] **9.5** Update `src/ui/import-modal.ts`
  - File mode: handle ZIP files using jszip
    - `import JSZip from 'jszip'`
    - Load ZIP, find `conversations.json` inside
    - If not found, show error
  - Multi-conversation handling:
    - If ChatGPT JSON contains multiple conversations, show a dropdown selector
    - Call `listConversations()` to populate dropdown
    - User selects one, pass `conversationId` to parser

### Files Created/Modified
| File | Action | Purpose |
|------|--------|---------|
| `src/parsers/chatgpt-json-parser.ts` | Create | ChatGPT export parser |
| `src/parsers/claude-json-parser.ts` | Create | Claude export parser |
| `src/parsers/format-detector.ts` | Modify | Add JSON detection |
| `src/parsers/index.ts` | Modify | Register new parsers |
| `src/ui/import-modal.ts` | Modify | ZIP handling + conversation selector |

### Acceptance Criteria
- [ ] `npm run build` succeeds
- [ ] ChatGPT JSON parser correctly handles the tree structure (walks `current_node` branch)
- [ ] ChatGPT JSON parser skips null/empty nodes with parse warnings
- [ ] Claude JSON parser handles both flat `chat_messages` and nested structures
- [ ] ZIP files are extracted and `conversations.json` is found and parsed
- [ ] Multi-conversation files show a selection dropdown
- [ ] Format detector correctly identifies JSON formats (prioritized over paste)
- [ ] Timestamps are correctly extracted from both formats

### Commit Message title
`feat: implement JSON file parsers for ChatGPT and Claude exports`

### Commit and Push to Main
---

## Phase 10: Ollama Integration

**Goal:** Optional LLM-enhanced segmentation via local Ollama instance.

**Dependencies:** Phase 4

### Tasks

- [ ] **10.1** Create `src/segmentation/ollama/client.ts`
  - Export `OllamaClient` class
  - Constructor: receives endpoint URL
  - `healthCheck(): Promise<boolean>` -- `GET /` with 3s timeout via `requestUrl`
  - `listModels(): Promise<string[]>` -- `GET /api/tags`, extract model names
  - `generate(prompt: string, model: string): Promise<string>` -- `POST /api/generate` with 60s timeout
  - All methods catch errors and return sensible defaults (false for health, empty for models, throw for generate)

- [ ] **10.2** Create `src/segmentation/ollama/chunker.ts`
  - Export `chunkConversation(messages: Message[], targetChars: number, overlapMessages: number): MessageChunk[]`
  - `MessageChunk` interface: `messages: Message[]`, `startIndex: number`, `endIndex: number`
  - Target: ~12,000 chars per chunk
  - Overlap: 4 messages repeated between chunks
  - Never split in the middle of a message
  - Handle conversations shorter than one chunk (return single chunk)

- [ ] **10.3** Create `src/segmentation/ollama/prompts.ts`
  - Export `buildSegmentationPrompt(messages: Message[], granularity: Granularity): string`
  - Prompt structure:
    - System instruction: "You are analyzing a conversation to identify topic segments"
    - Granularity instruction: how finely to split
    - Numbered message list: `[{index}] {role}: {first 200 chars of plainText}`
    - Output format: JSON array of `{ startIndex, endIndex, title, summary, confidence }`
    - Constraint: "Only split before user messages"
    - Example output

- [ ] **10.4** Create `src/segmentation/ollama/ollama-segmenter.ts`
  - Export `segmentWithOllama(conversation: ParsedConversation, config: SegmentationConfig, endpoint: string, model: string): Promise<Segment[]>`
  - Algorithm:
    1. Health check -- if fails, throw (caller handles fallback)
    2. Chunk conversation
    3. For each chunk: build prompt, call `generate()`, parse JSON response
    4. Merge split points across chunks (dedup overlapping boundaries within overlap zones)
    5. Validate all indices reference valid messages
    6. Construct `Segment[]` with titles/summaries from LLM
    7. Generate tags using `tag-generator.ts` (not from LLM)
  - Error handling: if JSON parsing fails or indices invalid, throw (caller falls back to heuristic)

- [ ] **10.5** Update `src/segmentation/segmenter.ts`
  - Add `segmentWithFallback(conversation, config, ollamaSettings?): Promise<Segment[]>`
  - If Ollama enabled and settings provided: try `segmentWithOllama()`, fall back to heuristic on any error
  - Log fallback reason if debug logging enabled

- [ ] **10.6** Update `src/ui/import-modal.ts`
  - When "Use Ollama" toggle is on in Step 2, call `segmentWithFallback()` instead of `segment()`
  - Show appropriate loading message: "Consulting Ollama for enhanced segmentation..."
  - If fallback occurs, show Notice: "Ollama unavailable, using built-in analysis"

### Files Created/Modified
| File | Action | Purpose |
|------|--------|---------|
| `src/segmentation/ollama/client.ts` | Create | Ollama HTTP client |
| `src/segmentation/ollama/chunker.ts` | Create | Context window chunking |
| `src/segmentation/ollama/prompts.ts` | Create | Prompt templates |
| `src/segmentation/ollama/ollama-segmenter.ts` | Create | LLM segmentation logic |
| `src/segmentation/segmenter.ts` | Modify | Add fallback orchestration |
| `src/ui/import-modal.ts` | Modify | Ollama UI integration |

### Acceptance Criteria
- [ ] `npm run build` succeeds
- [ ] Health check correctly detects running/stopped Ollama
- [ ] Chunker produces valid chunks with correct overlap
- [ ] Prompt includes numbered messages and clear JSON output instructions
- [ ] Successful Ollama segmentation produces valid `Segment[]`
- [ ] Invalid Ollama response triggers automatic fallback to heuristic
- [ ] Unreachable Ollama triggers automatic fallback to heuristic
- [ ] UI shows appropriate loading and fallback messages
- [ ] Test connection button in settings works correctly

### Commit Message title
`feat: implement optional Ollama-powered segmentation with heuristic fallback`

### Commit and Push to Main
---

## Phase 11: Polish & Edge Cases

**Goal:** Handle all edge cases, finalize styling, verify end-to-end flows.

**Dependencies:** All previous phases

### Tasks

- [ ] **11.1** Edge case: empty or minimal input
  - Empty paste: show error "No content to analyze" immediately
  - Single message: return 1 segment, create 1 note + index
  - Two messages: return 1 segment (below minimum for splitting)

- [ ] **11.2** Edge case: very large conversations
  - Test with 500+ message conversation
  - Verify UI remains responsive during segmentation
  - If segmentation takes >1s, ensure progress indicator is visible
  - Consider `setTimeout` chunking if main thread blocks

- [ ] **11.3** Edge case: conversations with only user or only assistant messages
  - All user messages: parse normally, segment treats as single topic
  - All assistant messages: parse normally, segment treats as single topic

- [ ] **11.4** Edge case: code blocks with speaker labels
  - Verify code block guard works for: triple backtick, quadruple backtick, tildes
  - Test: code block containing "You said:" and "Human:" text
  - Verify these are not treated as message boundaries

- [ ] **11.5** Edge case: note naming and collisions
  - Test importing the same conversation twice
  - Verify collision resolution appends numeric suffix
  - Test with conversation titles containing special characters: colons, slashes, quotes

- [ ] **11.6** Edge case: missing/empty target folder
  - If configured folder does not exist, auto-create it
  - If folder creation fails, show error Notice

- [ ] **11.7** Edge case: conversation with no detectable topic changes
  - Single-topic conversation should produce exactly 1 segment
  - Summary should reflect the entire conversation's topic
  - Index note still created with 1 segment listed

- [ ] **11.8** Finalize custom callout CSS
  - `[!user]` callout: distinct styling from `[!assistant]`
  - `[!thinking]` callout: subtle/muted styling
  - `[!artifact]` callout: highlighted styling
  - Respect Obsidian's light/dark theme variables
  - Test in both default and popular community themes

- [ ] **11.9** Accessibility pass
  - All buttons have meaningful text labels
  - Tab order through modal is logical
  - Error messages visible and descriptive
  - Focusable elements have focus indicators

- [ ] **11.10** Debug logging review
  - When `debugLogging` is enabled, log:
    - Format detection result
    - Parse result summary (message count, warnings)
    - Segmentation scores for each boundary
    - Final segment count and titles
    - Note creation paths
  - All logs prefixed with `[Chat Splitter]`
  - No logging when debug is disabled

- [ ] **11.11** Error handling audit
  - Every `try/catch` has a meaningful error message
  - User-facing errors shown via `Notice` (not just console)
  - No unhandled promise rejections
  - Modal remains usable after recoverable errors (does not close or lock up)

- [ ] **11.12** Implement conversation-level duplicate detection
  - Before creating notes, scan vault for existing notes with matching `conversation_id` in frontmatter
  - If match found, show a prompt with three options: Overwrite existing, Skip (cancel import), Import as new (append numeric suffix to conversation title)
  - Use `vault.getMarkdownFiles()` + read frontmatter to check for matches

- [ ] **11.13** Final build and load test
  - Clean build: delete `main.js`, run `npm run build`, verify success
  - Load in fresh Obsidian vault
  - Full end-to-end test: paste import, file import, preview mode, settings persistence
  - Verify no console errors or warnings (other than debug logs)

### Acceptance Criteria
- [ ] All edge cases listed above handled without crashes or data loss
- [ ] Custom callout styles render correctly in both light and dark themes
- [ ] Debug logging is comprehensive when enabled, silent when disabled
- [ ] No unhandled errors in any user flow
- [ ] Plugin loads cleanly in a fresh vault with no prior configuration
- [ ] All previously passing acceptance criteria from phases 1-10 still pass

### Commit Message title 
`fix: handle edge cases, finalize styling, and polish error handling`

---

## Cross-Phase Dependency Summary

```
Phase 1 (Scaffold)
  |
Phase 2 (Types)
  |
  +--- Phase 3 (Paste Parsers) --- Phase 9 (JSON Parsers)
  |
  +--- Phase 4 (Segmentation) ---- Phase 10 (Ollama)
  |
  +--- Phase 5 (Note Generation)
  |
  +--- Phases 3+4+5 converge into:
       |
       Phase 6 (Import Modal + Wiring)
         |
         +--- Phase 7 (Preview Modal)
         |
         +--- Phase 8 (Settings Tab)
  |
  All phases converge into:
       |
       Phase 11 (Polish)
```

### Parallel Work Opportunities

Within the constraint of sequential phases, some tasks within phases can be parallelized:
- **Phase 4:** All 6 signal files (4.2-4.7) are independent of each other
- **Phase 5:** `sanitize.ts`, `templates.ts`, `frontmatter-builder.ts` are independent
- **Phase 7 and 8:** Can be done in parallel (both depend on Phase 6, not on each other)
- **Phase 9 and 10:** Can be done in parallel (Phase 9 depends on 3, Phase 10 depends on 4)

---

## Resolved Questions

1. **Test vault location** -- Standard symlink: symlink the plugin folder into a test vault's `.obsidian/plugins/` directory.
2. **Real test data** -- Two test fixtures provided: `TEST_PASTE_CONVERSATION.md` (ChatGPT paste format, multi-topic Caribbean research conversation) and `TEST_SHARE_EXPORT_LINK.md` (ChatGPT share URL for reference). These will be used to validate paste parsers during Phase 3.
3. **Branch** -- All work on `main` branch. Per CLAUDE.md Rule 7, no PR required; push directly to main.
4. **Deferred features** -- Confirmed deferred to post-v1.0: shared URL import, API key providers, non-English signal patterns, and `longest` branch strategy for ChatGPT tree walking.
