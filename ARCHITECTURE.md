# Chat Splitter - Architecture Document

> **Status:** Draft - Pending Review & Approval
> **Plugin ID:** `chat-splitter`
> **Platform:** Obsidian (Desktop & Mobile)
> **Last Updated:** 2026-02-11

This document is the complete technical specification for Chat Splitter. **No implementation code should be written until this document is reviewed and approved.**

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

Users accumulate long, multi-topic AI chat sessions (ChatGPT, Claude.ai) containing valuable planning notes, decisions, research, and code snippets trapped in monolithic transcripts. Existing plugins import conversations as-is (1 conversation = 1 note). Chat Splitter's differentiator is **intelligent decomposition**: breaking a single sprawling chat into multiple organized, topic-specific Obsidian notes with bidirectional links, tags, and an index note.

### Key Design Principles

- **Both copy-paste and file import equally important** as input methods
- **Offline-first heuristic segmentation** as primary, with optional Ollama support (API keys deferred to future work)
- **Per-import configuration** since users' vault conventions are still evolving
- **Smart defaults that auto-create notes**, with opt-in preview/adjust mode
- **Callout-style speaker formatting** as the default rendering

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
│   │   ├── chatgpt-paste-parser.ts
│   │   ├── chatgpt-json-parser.ts  # Includes tree walker for mapping structure
│   │   ├── claude-paste-parser.ts
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
│   │   └── sanitize.ts             # Filename sanitization
│   ├── ui/
│   │   ├── import-modal.ts         # Main 2-step import wizard
│   │   ├── preview-modal.ts        # Segment review/edit modal
│   │   ├── settings-tab.ts         # Plugin settings
│   │   └── folder-suggest.ts       # Folder autocomplete component
│   └── utils/
│       ├── templates.ts            # {{variable}} template rendering
│       └── stop-words.ts           # English stop word list
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
interface ParsedConversation {
  id: string;                      // UUID from source or generated
  title: string;                   // Conversation title (from source or first user message)
  source: 'chatgpt' | 'claude' | 'markdown';
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
  confidence: number;              // 0-1, how confident the segmenter is in this boundary
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

The registry is a simple ordered list. `detectFormat()` runs detection heuristics and returns the first match. If no specific parser matches, the generic Markdown parser is used.

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

### Claude JSON Parser

Claude exports contain a `chat_messages` array with simpler flat structure:
- `uuid`: Message ID
- `sender`: `"human"` or `"assistant"`
- `text`: Message content (may contain Markdown)
- `created_at`: ISO timestamp
- `attachments`: Array of file attachments
- `content`: Array of content blocks (for newer exports with thinking/artifacts)

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

### Generic Markdown Parser

Fallback parser for unrecognized formats. Treats input as a single conversation with speaker detection based on common patterns:
- `## User` / `## Assistant` headings
- `**User:**` / `**Assistant:**` bold labels
- `> ` blockquote alternation
- If no speaker pattern detected, entire input becomes a single message

---

## Segmentation Engine

### Signal-Based Heuristic Engine (Primary)

The heuristic engine evaluates every **user-message boundary** as a potential split point using 6 weighted signals. Split points only occur immediately before user messages — never in the middle of an assistant response.

#### Signal Definitions

| # | Signal | File | What It Detects | Default Weight (medium) |
|---|--------|------|----------------|------------------------|
| 1 | Transition phrases | `transition-phrases.ts` | Explicit topic change markers like "let's move on to...", "switching topics...", "now let's talk about...", "on a different note..." | 0.25 |
| 2 | Domain shift | `domain-shift.ts` | Jaccard similarity drop on domain-specific tokens (non-stop-word tokens) between a window of messages before and after the candidate boundary | 0.20 |
| 3 | Vocabulary shift | `vocabulary-shift.ts` | Cosine similarity of term-frequency vectors between sliding windows (TextTiling approach) | 0.20 |
| 4 | Reintroduction | `reintroduction.ts` | New-topic phrasing: "I have a question about...", "Can you help with...", "I need help with...", "What is..." at the start of a user message | 0.15 |
| 5 | Temporal gap | `temporal-gap.ts` | Gap of >30 minutes between consecutive messages (only when timestamps are available; contributes 0.0 otherwise) | 0.10 |
| 6 | Self-contained | `self-contained.ts` | Long structured assistant response (>500 words with headings/lists, suggesting a "deliverable") immediately followed by a short new user question | 0.10 |

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

For each segment, generate a short topic title:

1. Extract the first user message's first sentence (up to 80 chars)
2. If it's a question, use a cleaned version (remove "Can you", "Please", etc.)
3. Extract top 3 non-stop-word tokens by frequency across the segment
4. Combine: prefer the cleaned first question; fall back to keyword summary
5. Title case the result, cap at 50 characters

#### Tag Generation (`tag-generator.ts`)

Auto-generate tags for each segment based on domain detection patterns:

- Predefined domain patterns (regex → tag mapping):
  - Code-related terms → `coding`
  - Language-specific terms (python, javascript, etc.) → `coding/{language}`
  - Database terms → `database`
  - API/web terms → `web`
  - Design terms → `design`
  - Writing/content terms → `writing`
  - Math/science terms → `math`
- Tags are prefixed with the user's configured tag prefix (default: `ai-chat/`)
- Maximum 5 tags per segment

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
  config: ImportConfig
): GeneratedNote[];
```

Steps:
1. Resolve all note filenames (using naming template + sanitization)
2. Build frontmatter for each segment note
3. Format message content for each segment
4. Build navigation links (prev/next/parent)
5. Generate index note
6. Return array of `GeneratedNote` objects ready for `vault.create()`

### Frontmatter Builder (`frontmatter-builder.ts`)

Produces YAML frontmatter from `NoteFrontmatter` interface. Key behaviors:
- Dates formatted as `YYYY-MM-DD` for `date`, ISO 8601 for `date_imported`
- Wikilinks in frontmatter are quoted strings: `"[[Note Name]]"`
- Tags array uses the configured prefix
- `cssclasses` always includes `chat-segment` (or `chat-index` for index notes)

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

Default template: `{date} - {conversation_title} - {topic}`

- `{date}`: Conversation date formatted as `YYYY-MM-DD`
- `{conversation_title}`: Original conversation title (sanitized)
- `{topic}`: Segment topic title (sanitized)
- Index note: `{date} - {conversation_title} - Index`

Template is configurable in settings via `{{variable}}` syntax.

### Folder Structure

Default: `AI Chats/{conversation_title}/` (nested, one folder per conversation)

Configurable options:
- **Nested (default):** `{base_folder}/{conversation_title}/` — each conversation gets its own folder
- **Flat:** `{base_folder}/` — all notes in one folder, differentiated by filename

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
- "Analyze" button at bottom (disabled until input provided and format detected)
- Clicking "Analyze" triggers parsing + segmentation, then transitions to Step 2

#### Step 2: Configure & Create

**Layout:**
- **Summary card** at top: "Found X topics in Y messages" with segment titles listed
- **Per-import settings** (overriding plugin defaults for this import):
  - **Target folder:** Text input with folder autocomplete (`folder-suggest.ts`)
  - **Tag prefix:** Text input (default from settings)
  - **Granularity:** 3-way toggle (Coarse / Medium / Fine)
    - Changing granularity re-runs segmentation inline and updates the summary card
  - **Speaker style:** Dropdown (Callouts / Blockquotes / Bold)
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
| Naming template | Text | `{{date}} - {{conversation_title}} - {{topic}}` | Template for note filenames |
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
| Speaker style | Dropdown | `Callouts` | Callouts / Blockquotes / Bold |
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
| Custom frontmatter | Textarea | (empty) | Additional YAML fields added to every note |
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
  speakerStyle: 'callouts' | 'blockquotes' | 'bold';
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
  namingTemplate: '{{date}} - {{conversation_title}} - {{topic}}',
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
  speakerStyle: 'callouts' | 'blockquotes' | 'bold';
  keepFullTranscript: boolean;
  useOllama: boolean;
  namingTemplate: string;
  folderStructure: 'nested' | 'flat';
}
```

Initialized from `ChatSplitterSettings` defaults, then user may override per-import in the Import Modal Step 2.

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

### Dependency Graph

```
Phase 1 → Phase 2 → Phase 3 → Phase 9
                  ↘ Phase 4 → Phase 10
                  ↘ Phase 5
                        ↘
               Phases 3,4,5 → Phase 6 → Phase 7
                                      → Phase 8
                              All → Phase 11
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
