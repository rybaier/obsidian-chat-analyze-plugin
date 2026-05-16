# Changelog

## 0.1.2

### Fixes
- Replace JSZip with fflate for ZIP extraction. JSZip bundled IE-era setImmediate polyfills that dynamically create `<script>` elements, which Obsidian's security review flags. fflate has no such fallbacks and roughly halves the plugin bundle size.

## 0.1.1

### Fixes
- Bump minAppVersion to 1.4.10 for AbstractInputSuggest, Vault.createFolder, and Workspace.openLinkText API compatibility
- Replace lookbehind regex in summary builder for iOS < 16.4 compatibility
- Switch setTimeout/clearTimeout to activeWindow variants for popout window compatibility
- Move remaining inline styles in preview and import modals to CSS classes
- Remove unused variables and parameters flagged by lint

## 0.1.0 (Initial Release)

### Features
- Split AI chat conversations into organized, topic-specific notes
- Automatic topic segmentation using heuristic boundary detection
- Multiple input sources: paste, ChatGPT share URLs, ChatGPT export ZIPs
- Source detection for ChatGPT, Claude, and generic markdown conversations
- Per-segment tag generation with entity-based sub-tags
- Rich summary callouts: Questions Asked, Topics Covered, Key Takeaways, References
- Title generation with entity extraction, comparison detection, and heading analysis
- Optional Ollama-powered segmentation for local LLM support
- Configurable segmentation thresholds (min messages, min words, confidence)
- Long conversation fallback segmentation for single-topic chats
- Clean title output with artifact stripping and balanced bracket handling
