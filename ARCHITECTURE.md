# Chat Splitter - Architecture Document

> **Status:** v1.0 -- Current
> **Plugin ID:** `chat-splitter`
> **Platform:** Obsidian (Desktop & Mobile)
> **Last Updated:** 2026-02-28

This document is the complete technical specification for Chat Splitter.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Overview & Data Flow](#architecture-overview--data-flow)
3. [File & Folder Structure](#file--folder-structure)
4. [Core Data Model](#core-data-model)
5. [Parser System](#parser-system)
6. [Segmentation Engine](#segmentation-engine)
7. [Note Generation Pipeline](#note-generation-pipeline)
8. [UI/UX Specification](#uiux-specification)
9. [Settings Schema](#settings-schema)
10. [Implementation Roadmap](#implementation-roadmap)
11. [Risk Register](#risk-register)
12. [Decision Log](#decision-log)
13. [Verification Plan](#verification-plan)

---

## Overview

Users accumulate long, multi-topic AI chat sessions (ChatGPT, Claude.ai) containing valuable planning notes, decisions, research, and code snippets trapped in monolithic transcripts. Existing plugins import conversations as-is (1 conversation = 1 note). Chat Splitter's differentiator is **intelligent decomposition**: breaking a single sprawling chat -- or any long document -- into multiple organized, topic-specific Obsidian notes with bidirectional links, tags, and an index note.

### Key Design Principles

- **Both copy-paste and file import equally important** as input methods
- **Offline-first heuristic segmentation** as primary, with optional Ollama support (API keys deferred to future work)
- **Per-import configuration** since users' vault conventions are still evolving
- **Smart defaults that auto-create notes**, with opt-in preview/adjust mode
- **Callout-style speaker formatting** as the default rendering

### Scope & Limitations (v1.0)

**In scope:**
- Paste import (ChatGPT and Claude copy-paste text)
- File import (ChatGPT JSON export, Claude JSON export, ZIP files, markdown files)
- Document import (non-chat text with headings or paragraph structure)
- ChatGPT browser extension markdown (via expanded generic parser)
- Heuristic segmentation (offline) with optional Ollama enhancement
- Desktop and mobile support

**Deferred to post-v1.0:**
- Shared conversation URL import (fetching from ChatGPT/Claude share links)
- API key providers (OpenAI, Anthropic) for segmentation
- Batch import of multiple conversations
- Vault-aware linking suggestions to existing notes
- Non-English transition phrase and reintroduction signal patterns

**Known limitations:**
- Segmentation signal quality is optimized for English conversations. Four of six signals (domain shift, vocabulary shift, temporal gap, self-contained) are language-agnostic and work for any language. Two signals (transition phrases, reintroduction) use English patterns only.
- Tool call messages (Code Interpreter, web browsing, Claude tool use) are stripped during parsing. Only the final assistant response using tool output is retained.

---

## Architecture Overview & Data Flow

```
┌─────────────────────────────────────────────────────┐
│                    main.ts                          │
│  Plugin lifecycle, commands, ribbon, settings tab   │
└──────────┬──────────────────────────┬───────────────┘
           │                          │
     ┌─────▼─────┐           ┌───────▼────────┐
     │  UI Layer  │           │  Settings/Data │
     │            │           │                │
     │ ImportModal│           │ settings.ts    │
     │ PreviewModal           │ import-config  │
     │ SettingsTab│           └────────────────┘
     └──────┬─────┘
            │
   ┌────────▼─────────┐
   │  Parser Registry  │ ← Format auto-detection
   │                   │
   │ ChatGPT paste/JSON│
   │ Claude paste/JSON │
   │ Generic markdown  │
   └────────┬──────────┘
            │  ParsedConversation
   ┌────────▼──────────┐
   │ Segmentation Engine│ ← Heuristic (primary) or Ollama (optional)
   │                    │
   │ 6 signal detectors │
   │ Weighted scorer    │
   │ Greedy selector    │
   └────────┬───────────┘
            │  Segment[]
   ┌────────▼──────────┐
   │  Note Generator    │ → vault.create()
   │                    │
   │ Frontmatter builder│
   │ Content formatter  │
   │ Index note builder │
   │ Link resolver      │
   └────────────────────┘
```

### Data Flow Summary

1. **Input** — User pastes text or selects a file (JSON, ZIP, Markdown)
2. **Detection** — `format-detector.ts` identifies the source platform and input format
3. **Parsing** — The appropriate parser converts raw input into a `ParsedConversation`
4. **Segmentation** — The heuristic engine (or optionally Ollama) splits messages into topic-based `Segment[]`
5. **Generation** — Each segment becomes a Markdown note with frontmatter, callout-formatted messages, and wikilinks
6. **Output** — Notes are written to the vault via `vault.create()`, including an index/MOC note linking all segments

---

## File & Folder Structure

```
obsidian-chat-analyze-plugin/
├── src/
│   ├── main.ts                     # Plugin entry, commands, ribbon icon
│   ├── types/
│   │   ├── index.ts                # Barrel re-exports
│   │   ├── conversation.ts         # ParsedConversation, Message, ContentBlock
│   │   ├── segment.ts              # Segment, SegmentBoundary, SegmentationConfig
│   │   ├── generated-note.ts       # GeneratedNote, NoteFrontmatter, NoteLink
│   │   ├── settings.ts             # ChatSplitterSettings, DEFAULT_SETTINGS
│   │   └── import-config.ts        # Per-import ImportConfig
│   ├── parsers/
│   │   ├── index.ts                # ParserRegistry bootstrap + parseInput()
│   │   ├── parser-interface.ts     # IChatParser, InputFormat, ParseOptions
│   │   ├── format-detector.ts      # Auto-detection from content
│   │   ├── code-block-guard.ts     # Protects code blocks during speaker detection
│   │   ├── content-block-parser.ts # Shared text/code block extraction from raw message text
│   │   ├── chatgpt-paste-parser.ts
│   │   ├── chatgpt-json-parser.ts  # Includes tree walker for mapping structure
│   │   ├── claude-paste-parser.ts
│   │   ├── claude-web-parser.ts    # Date-stamped web copy-paste (no speaker labels)
│   │   ├── claude-json-parser.ts
│   │   └── markdown-parser.ts      # Generic fallback
│   ├── segmentation/
│   │   ├── index.ts                # Barrel exports
│   │   ├── segmenter.ts            # Orchestrator: runs signals, applies scorer
│   │   ├── scorer.ts               # Weighted composite scoring
│   │   ├── signals/
│   │   │   ├── transition-phrases.ts   # "let's move on to..." detection
│   │   │   ├── domain-shift.ts         # Jaccard similarity on domain tokens
│   │   │   ├── vocabulary-shift.ts     # TF-vector cosine similarity (TextTiling)
│   │   │   ├── temporal-gap.ts         # Timestamp gap detection
│   │   │   ├── self-contained.ts       # Long deliverable message detection
│   │   │   └── reintroduction.ts       # "I have a question about..." detection
│   │   ├── title-generator.ts      # Topic title extraction
│   │   ├── tag-generator.ts        # Auto-tag generation
│   │   ├── segment-utils.ts        # merge/split/rename helpers for preview
│   │   └── ollama/
│   │       ├── client.ts           # Health check, model listing
│   │       ├── ollama-segmenter.ts # LLM-based segmentation
│   │       ├── prompts.ts          # Prompt templates
│   │       └── chunker.ts          # Context window chunking
│   ├── generators/
│   │   ├── index.ts
│   │   ├── note-generator.ts       # Segment → markdown note
│   │   ├── index-note-generator.ts # MOC/index note creation
│   │   ├── frontmatter-builder.ts  # YAML frontmatter
│   │   ├── content-formatter.ts    # Speaker callouts, code blocks
│   │   ├── link-resolver.ts        # Prev/next/parent wikilinks
│   │   ├── key-info-extractor.ts   # Extracts summary, key points, links (legacy, still exported)
│   │   ├── summary-builder.ts     # Rich summary block: questions, topics, takeaways, links
│   │   └── sanitize.ts             # Filename sanitization
│   ├── ui/
│   │   ├── import-modal.ts         # Main 2-step import wizard
│   │   ├── preview-modal.ts        # Segment review/edit modal
│   │   ├── settings-tab.ts         # Plugin settings
│   │   └── folder-suggest.ts       # Folder autocomplete component
│   └── utils/
│       ├── templates.ts            # {{variable}} template rendering
│       ├── stop-words.ts           # English stop word list
│       └── debug-log.ts            # Gated console logging with [Chat Splitter] prefix
├── styles.css                      # Custom callout types + modal styles
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── .gitignore
└── version-bump.mjs
```

### Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| `main.ts` | Plugin lifecycle (`onload`/`onunload`), registers commands ("Split Chat", "Import Chat File"), adds ribbon icon, initializes settings tab |
| `types/` | All TypeScript interfaces and type definitions; no runtime logic |
| `parsers/` | Converts raw input (paste text or file content) into a normalized `ParsedConversation` structure |
| `segmentation/` | Analyzes a `ParsedConversation` and produces `Segment[]` — groups of messages representing distinct topics |
| `generators/` | Transforms `Segment[]` into Obsidian-ready Markdown files with frontmatter, formatted content, and wikilinks |
| `ui/` | All Obsidian modal and settings tab UI components |
| `utils/` | Shared utilities (template rendering, stop words) |

---

## Core Data Model

### ParsedConversation

The unified output of all parsers. Every parser, regardless of input format, must produce this structure.

```typescript
type ContentType = 'chat' | 'document';

interface ParsedConversation {
  id: string;                      // UUID from source or generated
  title: string;                   // Fallback chain: source title, first user message (50 chars), "Untitled Chat"
  source: 'chatgpt' | 'claude' | 'markdown';
  contentType: ContentType;        // 'chat' for conversations, 'document' for non-chat text
  inputMethod: 'paste' | 'file-json' | 'file-zip' | 'file-markdown';
  createdAt: Date | null;
  updatedAt: Date | null;
  messages: Message[];
  messageCount: number;
  parseWarnings: string[];         // Non-fatal issues encountered during parsing
  sourceMetadata: {
    originalId?: string;           // Platform-specific conversation ID
    defaultModel?: string;         // e.g., "gpt-4", "claude-3-opus"
    sourceUrl?: string;            // URL if available
  };
}
```

### Message

```typescript
interface Message {
  id: string;                      // UUID from source or generated
  index: number;                   // 0-based position in conversation
  role: 'user' | 'assistant' | 'system' | 'tool';
  contentBlocks: ContentBlock[];   // Structured: text, code, thinking, artifact, etc.
  plainText: string;               // Flattened text for search/segmentation
  timestamp: Date | null;
  metadata: {
    model?: string;                // Model used for this specific message
    attachments?: Attachment[];
  };
}
```

### ContentBlock (Discriminated Union)

```typescript
type ContentBlock =
  | TextBlock
  | CodeBlock
  | ThinkingBlock
  | ArtifactBlock
  | ToolUseBlock
  | ImageBlock;

interface TextBlock {
  type: 'text';
  content: string;
}

interface CodeBlock {
  type: 'code';
  language: string;
  content: string;
  filename?: string;
}

interface ThinkingBlock {
  type: 'thinking';
  content: string;
}

interface ArtifactBlock {
  type: 'artifact';
  title: string;
  artifactType: string;           // e.g., "code", "document", "svg"
  language?: string;
  content: string;
}

interface ToolUseBlock {
  type: 'tool_use';
  toolName: string;
  input: string;
  output?: string;
}

interface ImageBlock {
  type: 'image';
  altText: string;
  url?: string;                    // External URL or omitted if inline
}

interface Attachment {
  name: string;
  mimeType?: string;
  size?: number;
}
```

### Segment

```typescript
interface Segment {
  id: string;                      // Generated UUID
  title: string;                   // Auto-generated topic title
  summary: string;                 // 1-2 sentence summary
  tags: string[];                  // Auto-generated tags (e.g., ["coding", "sql"])
  messages: Message[];             // References to messages in this segment
  startIndex: number;              // Index of first message (inclusive)
  endIndex: number;                // Index of last message (inclusive)
  confidence: number;              // Composite score of the boundary that starts this segment (1.0 for first segment)
  method: 'heuristic' | 'ollama' | 'manual';
}

interface SegmentBoundary {
  beforeIndex: number;             // Split occurs before message at this index
  score: number;                   // Composite signal score
  signals: SignalResult[];         // Individual signal contributions
}

interface SignalResult {
  signal: string;                  // Signal name (e.g., "domain-shift")
  score: number;                   // 0-1 raw score
  weight: number;                  // Weight applied
  detail?: string;                 // Human-readable explanation
}
```

### GeneratedNote

```typescript
interface GeneratedNote {
  path: string;                    // Full vault path (e.g., "AI Chats/My Chat/topic.md")
  filename: string;                // Just the filename
  content: string;                 // Complete Markdown content including frontmatter
  frontmatter: NoteFrontmatter;
  isIndex: boolean;                // True for the index/MOC note
  segmentId?: string;              // Links back to the segment
}

interface NoteFrontmatter {
  cssclasses: string[];
  source: string;
  conversation_id: string;
  conversation_title: string;
  segment?: number;
  segment_total?: number;
  topic?: string;
  date: string;                    // ISO date (YYYY-MM-DD)
  date_imported: string;           // ISO datetime
  tags: string[];
  message_count: number;
  prev?: string;                   // Wikilink to previous segment note
  next?: string;                   // Wikilink to next segment note
  parent?: string;                 // Wikilink to index note
}

interface NoteLink {
  type: 'prev' | 'next' | 'parent' | 'child';
  target: string;                  // Note filename (without .md)
  display?: string;                // Display text for wikilink
}
```

### SegmentationConfig

```typescript
interface SegmentationConfig {
  granularity: 'coarse' | 'medium' | 'fine';
  method: 'heuristic' | 'ollama';
  signalWeights: Record<string, number>;
  thresholds: GranularityThresholds;
}

interface GranularityThresholds {
  confidenceThreshold: number;     // Minimum score to accept a split
  minMessages: number;             // Minimum messages per segment
  minWords: number;                // Minimum words per segment
}

// Preset thresholds:
// coarse:  { confidenceThreshold: 0.70, minMessages: 8, minWords: 500 }
// medium:  { confidenceThreshold: 0.50, minMessages: 4, minWords: 200 }
// fine:    { confidenceThreshold: 0.35, minMessages: 2, minWords: 80 }
```

---

## Parser System

### Format Detection

`format-detector.ts` examines raw input content and returns an `InputFormat` discriminant:

```typescript
type InputFormat =
  | { source: 'chatgpt'; method: 'paste' }
  | { source: 'chatgpt'; method: 'file-json' }
  | { source: 'claude'; method: 'paste' }
  | { source: 'claude'; method: 'file-json' }
  | { source: 'markdown'; method: 'paste' }
  | { source: 'markdown'; method: 'file-markdown' };
```

**Detection heuristics (in priority order):**

1. **JSON structure check** — If input parses as JSON:
   - Has `mapping` key with nested `message` objects → ChatGPT JSON
   - Has `chat_messages` array with `sender` field → Claude JSON
2. **Paste pattern matching** — If input is plain text:
   - Lines matching `^You said:` or `^ChatGPT said:` → ChatGPT paste
   - Lines matching `^Human:` at line start or Claude-style turn markers → Claude paste
   - 2+ date-stamp lines (`^Jan 1$`, `^Feb 23$`, etc.) without `Human:`/`Assistant:` labels → Claude web paste
3. **Generic fallback** — Treat as generic Markdown conversation

### Parser Interface

```typescript
interface IChatParser {
  readonly format: InputFormat;
  canParse(input: string): boolean;
  parse(input: string, options?: ParseOptions): ParsedConversation;
}

interface ParseOptions {
  conversationId?: string;         // For multi-conversation JSON files
  branchStrategy?: 'current' | 'longest';  // ChatGPT tree traversal
}
```

### Parser Registry

```typescript
// parsers/index.ts
function parseInput(input: string, options?: ParseOptions): ParsedConversation {
  const format = detectFormat(input);
  const parser = registry.get(format);
  return parser.parse(input, options);
}
```

The registry is a simple ordered list: `ChatGPTPasteParser` → `ClaudePasteParser` → `ClaudeWebParser` → `MarkdownParser`. `detectFormat()` runs detection heuristics and returns the first match. If no specific parser matches, the generic Markdown parser is used.

### Code Block Guard

`code-block-guard.ts` addresses a critical edge case: code blocks may contain text that looks like speaker labels (e.g., `"You said:"` inside a code example).

**Algorithm:**
1. Find all fenced code blocks (`` ``` `` delimited) in the raw input
2. Replace their contents with unique placeholder tokens (e.g., `__CODE_BLOCK_0__`)
3. Run speaker detection / line-based parsing on the sanitized input
4. After parsing, restore code block content from the placeholder map

This ensures speaker detection regex patterns never match inside code fences.

### ChatGPT JSON Parser

ChatGPT exports use a tree structure where conversations can branch. Each node in the `mapping` object has:
- `id`: Node UUID
- `message`: Message content (may be null for root nodes)
- `parent`: Parent node ID
- `children`: Array of child node IDs

**Tree traversal strategy:**
- Default (`current`): Follow the `current_node` pointer backward to root, then reverse for chronological order
- Alternative (`longest`): Walk the longest path from root

**Edge case handling:**
- Skip nodes where `message` is null (root/system nodes)
- Skip nodes where `message.content.parts` is empty
- Add parse warnings for skipped nodes
- Handle `content_type` variations: `text`, `code`, `execution_output`, `tether_browsing_display_result`, `multimodal_text`
- Filter out messages where `author.role` is `tool` or `system` -- only retain `user` and `assistant` messages

### Claude JSON Parser

Claude exports contain a `chat_messages` array with simpler flat structure:
- `uuid`: Message ID
- `sender`: `"human"` or `"assistant"`
- `text`: Message content (may contain Markdown)
- `created_at`: ISO timestamp
- `attachments`: Array of file attachments
- `content`: Array of content blocks (for newer exports with thinking/artifacts)
- Filter out messages where `sender` is not `human` or `assistant`

### Paste Parsers (ChatGPT & Claude)

Line-based parsers that split on speaker label patterns:

**ChatGPT paste patterns:**
- `You said:` → user message (content starts on next line)
- `ChatGPT said:` → assistant message (content starts on next line)
- Variant: `You:` / `ChatGPT:` (older format)

**Claude paste patterns:**
- `Human:` at line start → user message (content follows on same line or next)
- `Assistant:` or `Claude:` at line start → assistant message

**Common handling:**
- Code block guard applied before speaker detection
- Consecutive lines without a speaker label are appended to the current message
- Leading/trailing whitespace trimmed from each message
- Empty messages filtered out with parse warning
- Tool-role messages (Code Interpreter results, browsing results) are filtered out during parsing; only user and assistant messages are retained

### Claude Web Paste Parser

`claude-web-parser.ts` handles conversations copied from the Claude.ai web interface where no `Human:`/`Assistant:` labels are present. The only structural markers are date stamps on their own lines (e.g., `Jan 1`, `Feb 23`).

**Detection (`canParse`):**
- Reject if `Human:`/`Assistant:`/`Claude:` labels are present (those belong to `ClaudePasteParser`)
- Mask code blocks to prevent false matches on dates inside code
- Count lines matching `^(Jan|Feb|Mar|...|Dec)\s+\d{1,2}$`
- Require 2+ date-stamp lines

**Parsing algorithm:**
1. Mask code blocks, find all date-stamp line positions
2. Split text into sections at date boundaries
3. Section 0 (before first date) = first user message
4. Each date section: backward-scan from end to find trailing user message. A paragraph is "user-like" if: < 300 chars, no code fences, no headings, no lists, no bold. If the scan would consume the entire section, treat it all as assistant.
5. Final section (after last date, no following date) = assistant message only
6. Returns `contentType: 'chat'`, `source: 'claude'`, `inputMethod: 'paste'`

### Generic Markdown Parser

Fallback parser for unrecognized formats. First attempts speaker detection based on common patterns:
- `## User` / `## Assistant` headings
- `#### You:` / `#### ChatGPT:` headings (common browser extension format)
- `#### Human:` / `#### Assistant:` headings (extension variant)
- `**User:**` / `**Assistant:**` bold labels
- `> ` blockquote alternation
- Frontmatter with conversation metadata (title, date, model fields)

If a speaker pattern is detected, sets `contentType: 'chat'`. If no speaker pattern is detected, the parser attempts document splitting:

1. **Heading-based splitting:** Strip frontmatter, scan for `#{1-6}` headings (code blocks already masked), split at heading boundaries. Each heading section becomes a `Message` with `role: 'user'`. Sections with fewer than 10 words are skipped.
2. **Paragraph-group fallback:** If no headings found, group consecutive paragraphs (groups of ~3, separated by double-newlines). Requires at least 4 paragraphs to attempt.
3. **Single-message fallback:** If neither produces 2+ sections, the entire input becomes a single message.

When 2+ sections are produced, sets `contentType: 'document'`; otherwise `contentType: 'chat'`.

---

## Segmentation Engine

### Signal-Based Heuristic Engine (Primary)

The heuristic engine evaluates every **user-message boundary** as a potential split point using 6 weighted signals. Split points only occur immediately before user messages — never in the middle of an assistant response.

#### Signal Definitions

| # | Signal | File | What It Detects | Weight (all granularities) |
|---|--------|------|----------------|------------------------|
| 1 | Transition phrases | `transition-phrases.ts` | Explicit topic change markers like "let's move on to...", "switching topics...", "now let's talk about...", "on a different note..." | 0.25 |
| 2 | Domain shift | `domain-shift.ts` | Jaccard similarity drop on domain-specific tokens (non-stop-word tokens) between a window of messages before and after the candidate boundary | 0.20 |
| 3 | Vocabulary shift | `vocabulary-shift.ts` | Cosine similarity of term-frequency vectors between sliding windows (TextTiling approach) | 0.20 |
| 4 | Reintroduction | `reintroduction.ts` | New-topic phrasing: "I have a question about...", "Can you help with...", "I need help with...", "What is..." at the start of a user message | 0.15 |
| 5 | Temporal gap | `temporal-gap.ts` | Gap of >30 minutes between consecutive messages (only when timestamps are available; contributes 0.0 otherwise) | 0.10 |
| 6 | Self-contained | `self-contained.ts` | Long structured assistant response (>500 words with headings/lists, suggesting a "deliverable") immediately followed by a short new user question | 0.10 |

Signal weights are constant across all granularity levels. Granularity is controlled exclusively through the confidence threshold and minimum segment size, not through weight adjustments.

**Document signal weights:** When `contentType === 'document'`, the segmenter overrides signal weights with a document-specific profile that zeroes out chat-only signals:

| Signal | Document Weight |
|--------|----------------|
| transition-phrases | 0.00 |
| domain-shift | 0.50 |
| vocabulary-shift | 0.50 |
| reintroduction | 0.00 |
| temporal-gap | 0.00 |
| self-contained | 0.00 |

This redistribution ensures domain and vocabulary shifts -- the only signals meaningful for documents -- can reach sufficient composite scores to trigger splits.

#### Scoring Algorithm

```
For each candidate boundary (before user message at index i):
  1. Compute each signal's raw score (0.0 to 1.0)
  2. Multiply by signal weight
  3. Sum weighted scores → composite score for this boundary
```

**Implementation detail (scorer.ts):**
```typescript
interface ScoredBoundary {
  beforeIndex: number;
  compositeScore: number;
  signals: SignalResult[];
}

function scoreBoundaries(
  messages: Message[],
  config: SegmentationConfig
): ScoredBoundary[];
```

#### Greedy Selection Algorithm

```
1. Score all candidate split points
2. Sort by composite score (descending)
3. Filter: remove candidates below confidence threshold
4. Greedy select:
   a. Take the highest-scoring unselected boundary
   b. Check if adding this split would create any segment smaller than minimum size
   c. If valid, accept; if not, skip
   d. Repeat until no more valid candidates
5. Sort accepted boundaries by message index (chronological order)
6. Produce Segment[] from the boundary list
```

**Key design principle:** Better to under-split than create garbage. A single large segment with mixed topics is more useful than three tiny segments with broken context.

#### Signal Implementation Details

**Transition Phrases (`transition-phrases.ts`):**
- Regex patterns matched against the first 200 characters of user messages
- Pattern categories: explicit transitions, context switches, topic introductions
- Score: 1.0 for strong match, 0.5 for weak match, 0.0 for no match
- Example patterns: `/^(let'?s|can we|i want to)\s+(move on|switch|change|talk about|discuss)/i`

**Domain Shift (`domain-shift.ts`):**
- Extract domain tokens: lowercase, remove stop words, keep tokens >2 chars
- Window size: 3 messages before and 3 messages after the boundary
- Compute Jaccard similarity: `|A ∩ B| / |A ∪ B|`
- Score: `1.0 - jaccard_similarity` (high score = low similarity = likely topic change)
- Minimum token count: if either window has <5 tokens, score is 0.0

**Vocabulary Shift (`vocabulary-shift.ts`):**
- Build term-frequency vectors for windows before and after boundary
- Window size: 3 messages (configurable)
- Compute cosine similarity between TF vectors
- Score: `1.0 - cosine_similarity`
- Uses the TextTiling approach adapted for chat messages

**Temporal Gap (`temporal-gap.ts`):**
- Only fires when both adjacent messages have timestamps
- Gap threshold: 30 minutes (1800 seconds)
- Score: `min(1.0, gap_minutes / 120)` — scales linearly, maxes at 2 hours
- Score is 0.0 when timestamps are unavailable

**Self-Contained (`self-contained.ts`):**
- Checks the assistant message immediately before the boundary
- "Deliverable" heuristic: word count >500 AND (contains 2+ headings OR 5+ list items)
- Also checks that the user message after the boundary is "short" (<100 words, suggesting a new topic rather than a follow-up)
- Score: 1.0 if both conditions met, 0.0 otherwise

**Reintroduction (`reintroduction.ts`):**
- Regex patterns matched against user messages at the boundary
- Patterns detect: new questions, help requests, fresh topic introductions
- Score: 1.0 for strong match, 0.5 for moderate match, 0.0 for no match
- Example: `/^(i have a question|can you help|i need help|could you explain|what('?s| is))/i`

#### Title Generation (`title-generator.ts`)

For each segment, generate a short topic title using a 5-strategy priority chain. The first strategy to produce a non-null result wins:

1. **Assistant topic (headings or opening statement)** -- Scan assistant messages for markdown headings (`##`-`####`), score by level and frequency. If short, combine with user topic kernel for context (e.g., heading "Health" + user topic "Draven" = "Draven Character Health"). If no headings, extract the first meaningful sentence from the first assistant response, stripping greeting prefixes ("Sure!", "Great question!", etc.) and pattern phrases ("Here is a breakdown of..."). This is the highest-priority strategy because assistant content is the most reliable signal for what the conversation actually covers.
2. **Comparison detection** -- Match patterns like "X vs Y", "X or Y", "difference between X and Y", "compare X and Y". Extracts both sides, cleans them, and produces a "Side A vs Side B" title.
3. **Entity + topic kernel** -- Extract capitalized proper nouns from all messages (skipping words in a `CAPITALIZED_EXCLUSIONS` set of ~200 common English words). User messages are weighted 3x. Multi-word entities are merged. Fuzzy dedup handles misspellings (e.g., "carriibbean" vs "Caribbean") via duplicate-char normalization and prefix + 75% character overlap matching. Generic category nouns (countries, options, types, etc.) are stripped from the kernel. The topic kernel is extracted from the first user message's first verb phrase after stripping filler prefixes and action verb patterns, capped at 40 chars.
4. **Cleaned first sentence** -- Strip question prefixes ("Can you", "Please", etc.) and action verb patterns from the first user message's first sentence, title-case it, cap at 72 chars.
5. **Keyword frequency fallback** -- Top 3 non-stop-word tokens by frequency across all messages in the segment, title-cased.

#### Tag Generation (`tag-generator.ts`)

Auto-generate tags for each segment based on domain detection patterns:

- Predefined domain patterns (regex to tag mapping):
  - Code-related terms (language names, syntax patterns) → `coding`
  - Language-specific terms (python, javascript, etc.) → `coding/{{language}}`
  - Database terms (sql, postgres, schema, etc.) → `database`
  - API/web terms (api endpoint, rest, graphql, etc.) → `web`
  - Design terms (figma, wireframe, ui/ux, etc.) → `design`
  - Writing/content terms (essay, blog, proofread, etc.) → `writing`
  - Real estate terms (property, mortgage, rental, etc.) → `real-estate`
  - Finance terms (investment, portfolio, stock, etc.) → `finance`
  - Immigration terms (citizenship, visa, residency, etc.) → `immigration`
  - Travel terms (flight, hotel, itinerary, etc.) → `travel`
  - Health terms (healthcare, medical, insurance, etc.) → `health`
  - AI/ML terms (machine learning, neural network, LLM, etc.) → `ai-ml`
- Tags are prefixed with the user's configured tag prefix (default: `ai-chat/`)
- Maximum 5 tags per segment

The tag prefix should not include a trailing slash. The generator always appends `/` between the prefix and tag name. If the user enters a trailing slash in settings, it is trimmed automatically.

**Document tag generation:** For documents, tags are generated once from the full text (all messages combined) and applied to every segment. This ensures domain patterns have enough keyword occurrences to meet `minMatches` thresholds, since individual document segments may contain a keyword only once. Chat segments continue to generate tags per-segment.

### Ollama Integration (Optional Enhancement)

Located in `src/segmentation/ollama/`.

#### Client (`client.ts`)

```typescript
interface OllamaClient {
  healthCheck(): Promise<boolean>;        // GET / with 3s timeout
  listModels(): Promise<string[]>;        // GET /api/tags
  generate(prompt: string, model: string): Promise<string>;  // POST /api/generate
}
```

- Uses Obsidian's `requestUrl()` for all HTTP calls (ensures CORS compatibility)
- Default endpoint: `http://localhost:11434`
- Connection timeout: 3 seconds for health check, 60 seconds for generation

#### Ollama Segmenter (`ollama-segmenter.ts`)

1. Chunk the conversation at ~12,000 characters with 4-message overlap between chunks
2. For each chunk, send a structured prompt requesting:
   - Split points (by message index)
   - Confidence score (0-1) for each split
   - Suggested topic title for each resulting segment
3. Parse the JSON response; merge split points across chunks (dedup overlapping boundaries)
4. Validate: ensure all split points reference valid message indices
5. Automatic fallback to heuristic if:
   - Ollama is unreachable (health check fails)
   - Response is not valid JSON
   - Response references invalid message indices
   - Generation takes >60 seconds

**Partial failure behavior:** If Ollama succeeds for some chunks but fails for others, the entire Ollama segmentation is discarded and the system falls back to heuristic segmentation for the full conversation. Mixing heuristic and Ollama boundaries could produce inconsistent segment quality.

#### Prompt Templates (`prompts.ts`)

Structured prompt that:
- Provides conversation messages in a numbered format
- Requests JSON output with specific schema
- Includes examples of expected output format
- Instructs the model to only split at user message boundaries

#### Chunker (`chunker.ts`)

- Target chunk size: 12,000 characters (~3,000 tokens)
- Overlap: 4 messages repeated between adjacent chunks
- Never splits in the middle of a message
- Chunk boundaries always align to message boundaries

---

## Note Generation Pipeline

### Note Generator (`note-generator.ts`)

Orchestrates the conversion from `Segment[]` to `GeneratedNote[]`:

```typescript
function generateNotes(
  conversation: ParsedConversation,
  segments: Segment[],
  config: ImportConfig,
  customFrontmatter?: string
): GeneratedNote[];
```

Steps:
1. Resolve all note filenames (using naming template + sanitization)
2. Build frontmatter for each segment note (merging custom frontmatter if provided)
3. Format message content for each segment
4. Build rich summary block (questions, topics, takeaways, links) for each segment
5. Build navigation links (prev/next/parent)
6. Generate index note
7. Return array of `GeneratedNote` objects ready for `vault.create()`

### Summary Builder (`summary-builder.ts`)

Extracts structured summary information from a segment's messages and renders it as a multi-section callout block above the message transcript.

```typescript
function buildSummaryBlock(messages: Message[], segmentSummary: string, tags: string[]): string;
function extractQuestions(messages: Message[]): string[];
function extractTopics(messages: Message[]): string[];
function extractTakeaways(messages: Message[]): string[];
```

**`extractQuestions`** -- Extracts cleaned first sentences from user messages. Strips filler prefixes ("can you", "ok great", etc.) and action verb patterns. Deduplicates via normalized string comparison. Maximum 8 items.

**`extractTopics`** -- Scans assistant messages for headings (`##`-`####`), strips numbering prefixes ("1.", "Step 1:"). Falls back to the first meaningful sentence from each assistant response (stripping greeting prefixes). Deduplicates. Maximum 8 items.

**`extractTakeaways`** -- Scans assistant messages for recommendation/conclusion patterns: "recommend", "suggest", "should consider", "key takeaway", "in summary", "in conclusion", "most important", "the best option", "to summarize", "bottom line", "ultimately", "my advice". Also extracts bold phrases containing actionable language. Falls back to the first sentence of the last assistant message's final paragraph as a conclusion. Deduplicates. Maximum 6 items.

**`buildSummaryBlock`** renders as Obsidian callouts (empty sections omitted):
- `> [!abstract] Summary` -- one-liner segment summary with tag pills (always rendered)
- `> [!question] Questions Asked` -- numbered list of cleaned user questions
- `> [!list] Topics Covered` -- bulleted list of topics from headings or assistant openings
- `> [!tip] Key Takeaways` -- bulleted list of recommendations/conclusions
- `> [!link] References` -- bulleted list of URLs (tracking params stripped, formatted as `[domain](url)`)

Link extraction reuses `extractLinks` from `key-info-extractor.ts`.

### Key Info Extractor (`key-info-extractor.ts`) (Legacy)

Still exported from the generators barrel for backward compatibility but no longer used by `note-generator.ts`. The summary builder supersedes its functionality with richer extraction.

### Note Structure Order

Each segment note is assembled in this order:
1. YAML frontmatter
2. `# Title` heading
3. `> [!info]` metadata callout (segment N of M, source, date, message/section count)
4. Rich summary block (summary, questions asked, topics covered, key takeaways, references)
5. `---` horizontal rule separator
6. Formatted messages (using configured speaker style)
7. Navigation footer (prev/next/parent wikilinks)

For documents, the info callout uses "Section" instead of "Segment" and "Sections" instead of "Messages".

### Frontmatter Builder (`frontmatter-builder.ts`)

Produces YAML frontmatter from `NoteFrontmatter` interface. Key behaviors:
- Dates formatted as `YYYY-MM-DD` for `date`, ISO 8601 for `date_imported`
- Wikilinks in frontmatter are quoted strings: `"[[Note Name]]"`
- Tags array uses the configured prefix
- `cssclasses` includes `chat-segment` or `document-segment` for segment notes (based on `contentType`), `chat-index` for index notes, `chat-transcript` or `document-transcript` for full transcript notes

### Content Formatter (`content-formatter.ts`)

Formats messages according to the user's chosen speaker style:

**Callout style (default):**
```markdown
> [!user] User
> Message content here

> [!assistant] Assistant
> Response content here
```

- Messages over 800 words use collapsible callouts: `> [!assistant]-`
- Code blocks within messages are preserved with their original language tags
- Thinking blocks rendered as collapsed callouts: `> [!thinking]- Thinking`
- Artifact blocks rendered with title: `> [!artifact] Artifact: Title`

**Blockquote style (alternative):**
```markdown
**User:**
> Message content

**Assistant:**
> Response content
```

**Bold style (minimal):**
```markdown
**User:** Message content

**Assistant:** Response content
```

**Plain style (no labels):**
```markdown
Message content here

Another section of content
```
Renders content blocks directly with no speaker labels, callouts, or wrapping. Automatically selected for document imports. If timestamps are present, they are rendered as `<small>` below the content.

**ContentBlock rendering rules (all styles):**
- `TextBlock`: Rendered inline as markdown text
- `CodeBlock`: Rendered as fenced code blocks with language tag preserved
- `ThinkingBlock`: Rendered as collapsed callout: `> [!thinking]- Thinking` (always collapsed regardless of length)
- `ArtifactBlock`: Rendered as callout: `> [!note] Artifact: {title}` with content inside, language-tagged if code
- `ToolUseBlock`: Stripped during parsing (not rendered -- see Scope & Limitations)
- `ImageBlock`: Rendered as `![{altText}]({url})` if URL available, or `[Image: {altText}]` placeholder if no URL

**Role rendering:**
- `user` messages: Rendered with configured speaker style
- `assistant` messages: Rendered with configured speaker style
- `system` messages: Filtered out of note output (rarely useful to end users)
- `tool` messages: Filtered out during parsing (see Scope & Limitations)

### Index Note Generator (`index-note-generator.ts`)

Creates one Map of Content (MOC) note per imported conversation:

```markdown
---
cssclasses: [chat-index]
source: chatgpt
conversation_id: "abc-123"
conversation_title: "Building a REST API"
date: 2025-01-15
date_imported: 2025-01-20T14:30:00
tags: [ai-chat, ai-chat/index]
segment_count: 7
total_messages: 84
---

# Building a REST API

> [!info] Chat Import Summary
> **Source:** ChatGPT | **Date:** 2025-01-15 | **Segments:** 7 | **Messages:** 84

## Topics

| # | Topic | Messages | Tags |
|---|-------|----------|------|
| 1 | [[...Project Setup]] | 8 | `coding`, `nodejs` |
| 2 | [[...Authentication]] | 14 | `coding`, `auth` |
| 3 | [[...Database Schema]] | 12 | `coding`, `sql` |
| ... | ... | ... | ... |

## Segment Summaries

### 1. [[...Project Setup]]
Setting up the Node.js project with Express, discussing folder structure and dependency choices.

### 2. [[...Authentication]]
Implementing JWT-based authentication with refresh tokens and middleware.

...
```

### Full Transcript Note (Optional)

When `keepFullTranscript` is enabled, an additional note is generated containing the entire unsplit conversation:

- **Filename:** `{{date}} - {{conversation_title}} - Full Transcript`
- **Placement:** Same folder as segment notes
- **Frontmatter:** Same as segment notes but with `cssclasses: [chat-transcript]`, no `segment`/`segment_total`/`prev`/`next` fields, `parent` links to index note
- **Content:** All messages formatted with the configured speaker style, no segment headers or navigation footers
- **Index note link:** The index note includes a "Full Transcript" section linking to this note

### Link Resolver (`link-resolver.ts`)

Generates wikilinks for navigation between notes:
- `prev`: Points to the previous segment note (null for first segment)
- `next`: Points to the next segment note (null for last segment)
- `parent`: Points to the index note (always present for segment notes)

Links are stored both in frontmatter (for Dataview queries) and rendered in a navigation footer block.

**Navigation footer:**
```markdown
---
> [!info] Navigation
> Previous: [[...Authentication]] | [[...Index|Back to Index]] | Next: [[...Deployment]]
```

### Filename Sanitization (`sanitize.ts`)

Ensures filenames are valid across all platforms:
- Replace `/\:*?"<>|` with `-`
- Collapse multiple spaces/dashes into single
- Trim to 200 characters (leaving room for `.md` extension)
- Handle collision: if path exists, append ` (2)`, ` (3)`, etc.
- Check existence via `vault.getAbstractFileByPath()`

### Naming Convention

Default template: `{{topic}}`

- `{{date}}`: Conversation date formatted as `YYYY-MM-DD`
- `{{conversation_title}}`: Original conversation title (sanitized)
- `{{topic}}`: Segment topic title (sanitized)
- Index note uses `Index` as the topic value

Template is configurable in settings via `{{variable}}` syntax.

### Folder Structure

Default: `AI Chats/{{conversation_title}}/` (nested, one folder per conversation)

Configurable options:
- **Nested (default):** `{{base_folder}}/{{conversation_title}}/` — each conversation gets its own folder
- **Flat:** `{{base_folder}}/` — all notes in one folder, differentiated by filename

### Template Rendering (`utils/templates.ts`)

Simple `{{variable}}` template engine for naming templates:

```typescript
function renderTemplate(template: string, variables: Record<string, string>): string;
```

Available variables:
- `{{date}}` — Conversation date
- `{{conversation_title}}` — Full conversation title
- `{{topic}}` — Segment topic title
- `{{source}}` — Source platform (chatgpt, claude, markdown)
- `{{segment}}` — Segment number
- `{{segment_total}}` — Total segments

---

## UI/UX Specification

### Import Modal (2-Step Wizard)

`src/ui/import-modal.ts` — Extends Obsidian's `Modal` class.

#### Step 1: Input

**Layout:**
- Tab-style toggle at top: "Paste" | "File"
- **Paste mode:** Large `<textarea>` (min 300px height) with monospace font
  - Real-time format auto-detection badge below textarea (e.g., "Detected: ChatGPT paste format")
  - Badge updates on input with 300ms debounce
- **File mode:** "Choose File" button (styled) triggering hidden `<input type="file">`
  - Accepts: `.json`, `.zip`, `.md`
  - Shows selected filename and detected format after selection
  - For multi-conversation JSON files (ChatGPT full export), shows a dropdown to select which conversation
- **Quick settings** (between input area and button):
  - **Target folder:** Text input with folder autocomplete (same as Step 2; values carry through)
  - **Tag prefix:** Text input (same as Step 2; values carry through)
- "Analyze" button at bottom (disabled until input provided and format detected)
- Clicking "Analyze" triggers parsing + segmentation, then transitions to Step 2
- For documents: badge shows "Document" instead of format details; after analysis, speaker style auto-sets to "Plain"

#### Step 2: Configure & Create

**Layout:**
- **Header:** "Import Chat - Step 2: Configure" (or "Import Document" for documents)
- **Summary card** at top: "Found X topics in Y messages" (or "Y sections" for documents) with segment titles listed
- **Per-import settings** (overriding plugin defaults for this import):
  - **Target folder:** Text input with folder autocomplete (`folder-suggest.ts`)
  - **Tag prefix:** Text input (default from settings)
  - **Granularity:** 3-way toggle (Coarse / Medium / Fine)
    - Changing granularity re-runs segmentation inline and updates the summary card
    - Changing granularity discards any manual segment edits made in the preview modal (since segments are fully regenerated). If the user has previously edited segments via preview, a confirmation is shown before re-segmenting.
  - **Speaker style:** Dropdown (Callouts / Blockquotes / Bold / Plain)
  - **Keep full transcript:** Toggle — if on, also creates a single note with the complete unsplit conversation
  - **Use Ollama:** Toggle (only visible if Ollama enabled in settings and healthy)
- **"Create N Notes" button** (primary CTA) — creates notes with current configuration
- **"Preview segments..." link** — opens PreviewModal for manual adjustment
  - This link is always visible but can be made the default action via settings ("Always preview before creating")

#### Behavior Notes

- Modal width: 600px (constrained for readability)
- Step transition is animated (simple fade/slide)
- Error states: parse failures show inline error message with details
- Progress: during note creation, button shows "Creating... (3/7)" with progress

### Preview Modal (Opt-In)

`src/ui/preview-modal.ts` — Extends Obsidian's `Modal` class. Opened from Import Modal Step 2.

**Layout:**
- Scrollable vertical list of **segment cards**
- Each card shows:
  - **Editable title** (inline text input)
  - **Message count** and **confidence score**
  - **Tag pills** (removable, with "+" to add)
  - **Expandable message preview** — first 3 messages shown, "Show all" to expand
- **Controls between cards:**
  - **Merge up** button (combines this segment with previous)
  - **Split here** button (splits segment at a message boundary, with message-level click-to-split)
- **Bottom bar:**
  - Segment count summary
  - "Create Notes" button (finalizes from preview state)

#### Interaction Details

- **Merge:** Combines two adjacent segments. Title defaults to the first segment's title. Tags are unioned.
- **Split:** Opens an inline message list with clickable boundaries. Clicking between two messages creates a new split point. The new segment gets an auto-generated title.
- **Reorder:** Not supported (segments are chronological, reordering would break context).
- **Undo:** Single-level undo for merge/split operations (stores previous state).

### Settings Tab

`src/ui/settings-tab.ts` — Extends Obsidian's `PluginSettingTab` class.

Organized into 5 collapsible sections:

#### 1. General
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Default folder | Text + folder suggest | `AI Chats` | Base folder for imported conversations |
| Naming template | Text | `{{topic}}` | Template for note filenames |
| Tag prefix | Text | `ai-chat` | Prefix for auto-generated tags |
| Folder structure | Dropdown | `Nested` | Nested (per-conversation folder) or Flat |

#### 2. Segmentation
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Default granularity | Dropdown | `Medium` | Coarse / Medium / Fine |
| Min segment messages | Number | `4` | Minimum messages per segment |
| Min segment words | Number | `200` | Minimum words per segment |
| Always preview | Toggle | `false` | Open preview modal by default |

#### 3. Formatting
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Speaker style | Dropdown | `Callouts` | Callouts / Blockquotes / Bold / Plain |
| Show timestamps | Toggle | `true` | Include timestamps in messages (when available) |
| Collapse long messages | Toggle | `true` | Auto-collapse messages >800 words |
| Collapse threshold | Number | `800` | Word count threshold for collapsing |
| Keep full transcript | Toggle | `false` | Also create unsplit transcript note |

#### 4. AI Enhancement
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Enable Ollama | Toggle | `false` | Use Ollama for segmentation |
| Ollama endpoint | Text | `http://localhost:11434` | Ollama API endpoint |
| Ollama model | Dropdown | (auto-populated) | Model to use for segmentation |
| Test connection | Button | — | Checks Ollama connectivity and shows result |

#### 5. Advanced
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Custom frontmatter | Textarea | (empty) | Additional YAML fields added to every note. Validated as valid YAML on save; invalid input shows an error. |
| Debug logging | Toggle | `false` | Log detailed segmentation info to console |

### Folder Suggest (`folder-suggest.ts`)

Autocomplete component for folder path inputs:
- Extends Obsidian's `AbstractInputSuggest`
- Queries `vault.getAllLoadedFiles()` filtered to `TFolder` instances
- Filters suggestions as user types
- Selecting a suggestion fills the input

---

## Settings Schema

### ChatSplitterSettings

```typescript
interface ChatSplitterSettings {
  // General
  defaultFolder: string;
  namingTemplate: string;
  tagPrefix: string;
  folderStructure: 'nested' | 'flat';

  // Segmentation
  defaultGranularity: 'coarse' | 'medium' | 'fine';
  minSegmentMessages: number;
  minSegmentWords: number;
  alwaysPreview: boolean;

  // Formatting
  speakerStyle: 'callouts' | 'blockquotes' | 'bold' | 'plain';
  showTimestamps: boolean;
  collapseLongMessages: boolean;
  collapseThreshold: number;
  keepFullTranscript: boolean;

  // AI Enhancement
  enableOllama: boolean;
  ollamaEndpoint: string;
  ollamaModel: string;

  // Advanced
  customFrontmatter: string;
  debugLogging: boolean;
}

const DEFAULT_SETTINGS: ChatSplitterSettings = {
  defaultFolder: 'AI Chats',
  namingTemplate: '{{topic}}',
  tagPrefix: 'ai-chat',
  folderStructure: 'nested',
  defaultGranularity: 'medium',
  minSegmentMessages: 4,
  minSegmentWords: 200,
  alwaysPreview: false,
  speakerStyle: 'callouts',
  showTimestamps: true,
  collapseLongMessages: true,
  collapseThreshold: 800,
  keepFullTranscript: false,
  enableOllama: false,
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: '',
  customFrontmatter: '',
  debugLogging: false,
};
```

### ImportConfig (Per-Import Overrides)

```typescript
interface ImportConfig {
  targetFolder: string;
  tagPrefix: string;
  granularity: 'coarse' | 'medium' | 'fine';
  speakerStyle: 'callouts' | 'blockquotes' | 'bold' | 'plain';
  keepFullTranscript: boolean;
  useOllama: boolean;
  namingTemplate: string;
  folderStructure: 'nested' | 'flat';
}
```

Initialized from `ChatSplitterSettings` defaults, then user may override per-import in the Import Modal (folder and tag prefix available in Step 1; all settings available in Step 2). For document imports, `speakerStyle` is auto-set to `'plain'` after parsing.

---

## Implementation Roadmap

| Phase | Description | Size | Key Files | Dependencies |
|-------|-------------|------|-----------|-------------|
| **1** | Project scaffolding | S | `manifest.json`, `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `.gitignore`, empty `main.ts` | — |
| **2** | Core types & interfaces | S | `src/types/*.ts` | Phase 1 |
| **3** | Paste parsers + format detection | M | `src/parsers/format-detector.ts`, `*-paste-parser.ts`, `code-block-guard.ts` | Phase 2 |
| **4** | Heuristic segmentation engine | L | `src/segmentation/segmenter.ts`, `scorer.ts`, `signals/*.ts`, `title-generator.ts`, `tag-generator.ts` | Phase 2 |
| **5** | Note generation pipeline | M | `src/generators/*.ts`, `src/utils/*.ts` | Phase 2 |
| **6** | Import modal UI + plugin wiring | L | `src/ui/import-modal.ts`, `folder-suggest.ts`, `styles.css`, `main.ts` | Phases 3, 4, 5 |
| **7** | Preview modal UI | L | `src/ui/preview-modal.ts`, `segment-utils.ts` | Phase 6 |
| **8** | Settings tab | M | `src/ui/settings-tab.ts` | Phase 6 |
| **9** | JSON file parsers (ChatGPT + Claude) | M | `chatgpt-json-parser.ts`, `claude-json-parser.ts` | Phase 3 |
| **10** | Ollama integration | M | `src/segmentation/ollama/*.ts` | Phase 4 |
| **11** | Polish & edge cases | M | All files | All phases |
| **12** | Document splitting + folder/tag in Step 1 | M | `types/*.ts`, `markdown-parser.ts`, `segmenter.ts`, `content-formatter.ts`, `note-generator.ts`, `import-modal.ts`, `settings-tab.ts` | Phase 11 |

### Dependency Graph

```
Phase 1 → Phase 2 → Phase 3 → Phase 9
                  ↘ Phase 4 → Phase 10
                  ↘ Phase 5
                        ↘
               Phases 3,4,5 → Phase 6 → Phase 7
                                      → Phase 8
                              All → Phase 11 → Phase 12
```

### External Dependencies

- **`jszip`** — Required for ChatGPT/Claude ZIP file imports (Phase 9)
- No other external runtime dependencies
- Build tooling: `esbuild`, `typescript`, `@types/node`, `obsidian` (dev dependencies)

---

## Risk Register

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|-----------|-----------|
| 1 | Paste format fragility — platforms change their copy format | Parsers break for affected platform | Medium | Support multiple regex variants per platform; generic fallback parser ensures some functionality always works |
| 2 | Code blocks containing fake speaker labels (e.g., `"You said:"` in a code example) | Mis-parsed messages, broken conversation structure | High | `code-block-guard.ts`: replace code block content with placeholders before speaker detection, restore after |
| 3 | ChatGPT tree structure complexity (branching conversations) | Lost messages, incorrect ordering, crashes | Medium | Default to `current_node` branch traversal; skip null/empty nodes with parse warnings; add `branchStrategy` option |
| 4 | Segmentation quality without LLM | Poor topic boundaries, segments that don't match user expectations | Medium | Conservative defaults (under-split preferred); 3 granularity levels; preview mode for manual adjustment; Ollama as optional enhancement |
| 5 | Very large conversations (1000+ messages) | UI freeze, slow processing | Low | Segmentation is O(n*w) where w is small window size; note generation is sequential but each note is fast; progress indicators throughout |
| 6 | Note naming collisions | Overwritten files, data loss | Medium | Check `vault.getAbstractFileByPath()` before creating; append numeric suffix `(2)`, `(3)` on collision |
| 7 | Re-import of same conversation | Duplicate notes cluttering vault | Medium | Check for existing notes with matching `conversation_id` in frontmatter; prompt user: overwrite / skip / import as new |
| 8 | Ollama unavailable or returns invalid output | Segmentation fails silently or produces garbage | Low | Automatic fallback to heuristic engine; validate JSON response schema; timeout at 60 seconds |
| 9 | Custom frontmatter causes invalid YAML | Note creation fails, frontmatter unreadable | Low | Validate custom frontmatter as valid YAML before merging; show error in settings if invalid |
| 10 | Platform-specific file path issues | Failures on Windows/Linux/mobile | Low | Use Obsidian's `normalizePath()` for all paths; sanitize filenames per `sanitize.ts`; test on multiple platforms |

---

## Decision Log

| # | Decision | Rationale | Alternatives Considered |
|---|----------|-----------|------------------------|
| 1 | **Split only before user messages** | Splitting mid-assistant-response creates broken context. User messages are natural conversation boundaries. | Split at any message boundary — rejected because assistant responses often span multiple messages that form a coherent unit |
| 2 | **Callouts as default speaker style** | Obsidian's callout syntax provides visual distinction, collapsibility for long messages, and custom styling via CSS. Most visually polished option. | Blockquotes (less visual distinction), Bold labels (minimal but fast to scan), HTML (not portable) |
| 3 | **Heuristic-first, Ollama-optional** | Offline-first respects privacy and works without setup. Most users won't have Ollama. Heuristic is deterministic and fast. | LLM-only (requires setup, non-deterministic), Hybrid always-on (complex, slower) |
| 4 | **Per-import configuration** | User's vault conventions are evolving. Different conversations may need different settings (e.g., work vs personal chats in different folders). | Global-only settings — rejected because it's too rigid; users want flexibility per import |
| 5 | **Smart defaults with opt-in preview** | Most imports should "just work" with good defaults. Preview is powerful but adds friction. Default to auto-create, let power users opt into preview. | Always-preview (too much friction), No preview (no way to adjust) |
| 6 | **Auto-create notes (not auto-preview)** | Reduces friction to minimum. One click after configuration creates everything. Preview is opt-in. | Mandatory preview — rejected because it adds a step most users don't need |
| 7 | **Index/MOC note per conversation** | Provides a natural entry point and overview. Enables Dataview queries. Supports bidirectional navigation. | No index note (harder to navigate), Single note with embeds (doesn't scale) |
| 8 | **`jszip` as only external dependency** | ZIP support is necessary for full exports. jszip is well-maintained, small, and widely used. | Node.js built-in zlib (not available in Obsidian's runtime), Manual ZIP parsing (too complex, error-prone) |
| 9 | **ContentBlock discriminated union** | Preserves structural information from source (code blocks, thinking blocks, artifacts) instead of flattening to plain text. Enables richer formatting. | Plain text only — simpler but loses valuable structure |
| 10 | **TextTiling-inspired vocabulary shift** | Well-established algorithm for topic segmentation in text. Adapted for chat messages with smaller windows. Provides meaningful signal without ML. | LDA topic modeling (too heavy, needs training), Simple keyword overlap (too naive) |
| 11 | **6 weighted signals with configurable granularity** | Multiple weak signals combined produce robust segmentation. Granularity presets make it accessible. Individual weights are internal (not user-facing). | Single heuristic (too brittle), User-configurable weights (too complex for most users) |
| 12 | **Segment confidence scores** | Enables quality-based filtering and helps users understand why splits were made. Useful in preview mode. | Binary split/no-split — loses nuance |
| 13 | **Navigation links in both frontmatter and footer** | Frontmatter enables Dataview queries and graph view connections. Footer provides in-note navigation. | Frontmatter only (requires Dataview to navigate), Footer only (not queryable) |
| 14 | **Strip tool messages rather than rendering them** | Simplifies both parsing and rendering. Tool call details (Code Interpreter execution, browsing steps) add noise to the output notes. Users care about the final assistant response, not the intermediate tool interactions. | Render as collapsed callouts (adds complexity), Defer entirely (loses context about tool use existence) |
| 15 | **Desktop and mobile support from v1.0** | HTML file input works on both platforms. Paste works everywhere. Shipping mobile-compatible from the start avoids a painful retrofit and reaches a larger audience. | Desktop-only first (simpler but limits reach) |
| 16 | **English-only segmentation signals in v1.0** | Four of six signals are language-agnostic. The two English-only signals (transition phrases, reintroduction) gracefully degrade to 0.0 for non-English, leaving the other four signals to handle segmentation. Full i18n is deferred. | Add 2-3 extra languages (scope creep for v1.0), Auto-detect language and skip (adds complexity) |
| 17 | **Defer shared URL import to post-v1.0** | URL fetching introduces CORS complexity, HTML parsing fragility, and authentication concerns. Paste and file import cover the primary use cases. URLs can be added later. | Add as Phase 12 (adds scope and risk) |
| 18 | **Title fallback chain: source, first message, "Untitled Chat"** | Every conversation needs a title for filenames and index notes. The fallback chain ensures no empty titles while preferring the most meaningful option. | Always prompt user for title (adds friction) |
| 19 | **Document splitting via headings then paragraph groups** | Headings are the most reliable structural signal in documents. Paragraph groups provide a reasonable fallback for unstructured text. Both produce `role: 'user'` messages that flow through the existing segmentation pipeline without changes to the scorer. | Sentence-level splitting (too granular), fixed character count (ignores structure), require headings only (misses plain documents) |
| 20 | **Document signal weights: 50/50 domain-shift + vocabulary-shift** | Chat-only signals (transition phrases, reintroduction, temporal gap, self-contained) score 0.0 on documents since there are no speaker turns. Domain and vocabulary shifts are the only meaningful signals for documents. Equal weighting lets either signal drive a split. | Keep chat weights (max composite score ~0.40, below all thresholds), add new document-specific signals (over-engineering for v1.0) |
| 21 | **Full-text tag generation for documents** | Per-segment tag generation fails for documents because individual segments have too little text for domain patterns to reach `minMatches` thresholds (2-3 occurrences). Generating tags from the full document text and applying to all segments matches the chat experience where repeated keywords across turns satisfy the threshold. | Lower minMatches for documents (reduces precision), add document-specific patterns (maintenance burden) |
| 22 | **Plain speaker style for documents** | Documents don't have speaker roles, so callout/blockquote/bold labels ("User:", "Assistant:") are meaningless noise. Plain style renders content directly. Auto-selected for documents but available for chats too. | Always use callouts (confusing labels on documents), strip labels only for documents (special-case logic in formatter) |
| 23 | **Folder and tag prefix in Step 1** | These are the most commonly changed per-import settings. Surfacing them in Step 1 reduces friction -- users can set them before analysis rather than going back from Step 2. Values are shared state with Step 2. | Step 2 only (original design, extra click for common case), all settings in Step 1 (clutters the input step) |

---

## Verification Plan

These verification steps apply when implementation begins after architecture approval:

### Build Verification
- `npm install && npm run build` produces `main.js` without errors

### Plugin Load Test
- Copy built files into test vault's `.obsidian/plugins/chat-splitter/`
- Enable plugin in Obsidian settings
- Verify no console errors on load
- Verify ribbon icon appears
- Verify commands registered in command palette

### Paste Import End-to-End
- Open import modal via command or ribbon
- Paste a real ChatGPT conversation
- Verify format auto-detected and badge shown
- Click "Analyze", verify segmentation summary
- Configure settings (folder, tags, granularity)
- Click "Create Notes"
- Verify: notes created in correct folder, index note links work, frontmatter is valid YAML, callouts render correctly, navigation links work

### File Import End-to-End
- Import a ChatGPT JSON export file
- Select a conversation from the dropdown (if multi-conversation)
- Verify same flow and results as paste import

### Segmentation Quality
- Import a known multi-topic conversation (prepared test fixture)
- Test all three granularity levels:
  - **Coarse:** Few large segments, only the clearest topic changes
  - **Medium:** Balanced segmentation matching intuitive topic boundaries
  - **Fine:** Many smaller segments, catching subtle topic shifts
- Verify segments align with actual topic boundaries

### Edge Cases
| Test Case | Expected Behavior |
|-----------|-------------------|
| Empty paste | Error message: "No content to analyze" |
| 2-message conversation | Single segment (no split possible below minimum) |
| 500+ message conversation | Completes without UI freeze; progress shown |
| Code blocks containing "You said:" | Speaker label inside code block not treated as message boundary |
| Single-topic conversation | Single segment with appropriate title |
| Conversation with no timestamps | Temporal gap signal contributes 0.0; other signals still work |
| Duplicate import | Prompted to overwrite/skip/import as new |
| Document with headings | Badge shows "Document", heading-based splitting, plain formatting, document-aware labels |
| Document without headings (4+ paragraphs) | Paragraph-group fallback, plain formatting |
| Document without headings (<4 paragraphs) | Single-message fallback, treated as chat |
| Document segments with domain keywords | Tags generated from full text, applied to all segments |

### Settings Persistence
- Change every setting in the settings tab
- Reload Obsidian
- Verify all values persisted correctly

### Preview Mode
- Enable "Always preview" in settings
- Import a conversation
- In preview modal: rename a segment, merge two segments, split a segment
- Click "Create Notes"
- Verify final notes reflect all preview changes
