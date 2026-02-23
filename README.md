# Chat Splitter

Split long AI chat transcripts and documents into organized, topic-specific Obsidian notes.

Chat Splitter takes a sprawling multi-topic conversation from ChatGPT or Claude -- or any long-form document -- and breaks it into individual notes, one per topic or section, with auto-generated titles, tags, summaries, key points, bidirectional wikilinks, and an index (Map of Content) note tying everything together.

## Features

- **Multi-format import** -- paste text or import JSON/ZIP/Markdown files
- **ChatGPT + Claude support** -- paste format, JSON export, and ZIP archives
- **Document import** -- paste or import any long-form document; headings become section boundaries with paragraph-group fallback
- **Heuristic topic segmentation** -- 6 weighted signals detect topic boundaries offline, no API keys needed
- **Key info extraction** -- each note gets a summary, key points, and reference links in callout blocks
- **Auto-tagging** -- domain-aware tags (coding, database, web, design, writing, real-estate, finance, immigration, travel, health, ai-ml)
- **4-strategy title generation** -- comparison detection, entity + kernel, cleaned sentence, keyword fallback
- **Bidirectional wikilinks** -- prev/next/parent navigation in both frontmatter and footer
- **Index / MOC note** -- one Map of Content per conversation with topics table and summaries
- **Optional Ollama enhancement** -- use a local LLM for improved segmentation quality
- **Segment preview/edit** -- review, merge, split, and rename segments before creating notes
- **4 speaker styles** -- callouts (default), blockquotes, bold labels, or plain (no labels)
- **Per-import configuration** -- folder, tags, granularity, style adjustable each import from Step 1

## Installation

### Manual install

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Create a folder in your vault: `.obsidian/plugins/chat-splitter/`
3. Copy the three files into that folder
4. Open Obsidian Settings > Community plugins > enable "Chat Splitter"

### Build from source

```bash
git clone https://github.com/rybaier/obsidian-chat-analyze-plugin.git
cd obsidian-chat-analyze-plugin
npm install
npm run build
```

Then copy `main.js`, `manifest.json`, and `styles.css` into your vault's `.obsidian/plugins/chat-splitter/` folder.

## Usage

### Paste import

1. Open the command palette and run **Chat Splitter: Import from clipboard**
2. Paste your conversation text (or any long-form document) into the textarea
3. The format is auto-detected (ChatGPT paste, Claude paste, generic markdown, or document)
4. Set target folder and tag prefix (optional, also configurable in Step 2)
5. Click **Analyze** to parse and segment
6. Configure granularity, speaker style, and other options
7. Click **Create N Notes** to write notes to your vault

Documents with headings are automatically split at heading boundaries. Documents without headings fall back to paragraph-group splitting. The format badge shows "Document" when non-chat content is detected, and plain speaker style is auto-selected.

### File import

1. Open the command palette and run **Chat Splitter: Import from file**
2. Select a `.json`, `.zip`, or `.md` file
3. For multi-conversation ChatGPT exports, select which conversation to import
4. Same configuration and creation flow as paste import

### Preview mode

Click "Preview segments..." before creating notes to review the auto-detected topics. In preview mode you can:
- Rename segment titles
- Merge adjacent segments
- Split a segment at any message boundary
- Single-level undo for merge/split operations

Enable "Always preview" in settings to open preview mode by default.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Default folder | `AI Chats` | Base folder for imported conversations |
| Naming template | `{{topic}}` | Template for note filenames (`{{date}}`, `{{conversation_title}}`, `{{topic}}`, `{{source}}`, `{{segment}}`, `{{segment_total}}`) |
| Tag prefix | `ai-chat` | Prefix for auto-generated tags |
| Folder structure | Nested | Nested (per-conversation folder) or Flat |
| Default granularity | Medium | Coarse / Medium / Fine segmentation |
| Speaker style | Callouts | Callouts / Blockquotes / Bold / Plain |
| Keep full transcript | Off | Also create a single unsplit transcript note |
| Enable Ollama | Off | Use local Ollama for LLM-enhanced segmentation |
| Custom frontmatter | (empty) | Additional YAML fields added to every note |
| Debug logging | Off | Log detailed info to console with `[Chat Splitter]` prefix |

## Supported Formats

| Format | Method | Notes |
|--------|--------|-------|
| ChatGPT paste | Paste | "You said:" / "ChatGPT said:" format |
| ChatGPT JSON export | File | Single or multi-conversation `.json` files |
| ChatGPT ZIP export | File | ZIP archives containing `conversations.json` |
| Claude paste | Paste | "Human:" / "Assistant:" format |
| Claude JSON export | File | `chat_messages` array format |
| Generic markdown | Paste/File | Heading-based or bold-label speaker patterns |
| Documents | Paste/File | Any long-form text; splits at headings or paragraph groups |

## License

[MIT](LICENSE)
