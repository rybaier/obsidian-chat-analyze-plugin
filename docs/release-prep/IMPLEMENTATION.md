# Implementation Tracker

## Phase 1: Tooling + Submission Blockers
- [x] A4 - Update TypeScript/esbuild/types to latest
- [x] A1 - Create `versions.json`
- [x] A2 - Update `package.json` metadata
- [x] A3 - Add `authorUrl` to `manifest.json`

## Phase 2: Critical Output Quality
- [ ] B1 - Fix tag differentiation (per-segment instead of conversation-wide)
- [ ] B2 - Fix segmentation fallback (prevent 1-segment output for long chats)
- [ ] B3 - Fix title artifacts (em-dashes, punctuation prefixes)
- [ ] B4 - Fix title truncation (unbalanced parentheses)

## Phase 3: Callout Quality + Infrastructure
- [ ] B5 - Questions Asked filter (only actual questions)
- [ ] B6 - Topics Covered filter (no conversational fragments)
- [ ] B7 - Key Takeaways filter (meaningful insights only)
- [ ] A5 - GitHub Actions release workflow
- [ ] A6 - Ollama timeout
- [ ] A7 - Clean up `.gitignore`
- [ ] A8 - Clean up `tsconfig.json`

## Phase 4: Polish + Submission
- [ ] A9 - CHANGELOG.md
- [ ] A10 - GitHub release + submission (requires Ryan approval)
