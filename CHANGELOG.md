# Changelog

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
