# Decision Log

## Phase 1

### D1: TypeScript version target
- **Decision:** Update TypeScript 4.7.4 -> 5.x, esbuild 0.17.3 -> 0.24.x, @types/node -> latest LTS
- **Rationale:** Obsidian community plugins commonly use TS5 + latest esbuild. No breaking changes expected for our codebase.

## Phase 2

### D2: Per-segment tag generation for documents
- **Decision:** Change document-mode tag override from `generateTags(messages, tagPrefix)` to `generateTags(seg.messages, tagPrefix)` per segment.
- **Rationale:** Conversation-wide tagging gave every segment identical tags. Per-segment generation produces differentiated tags that reflect each segment's actual content.

### D3: Long-conversation segmentation fallback
- **Decision:** When 0 boundaries pass the confidence threshold but conversation length >= 3x minMessages, force-pick the N highest-scoring boundaries. Also lower MIN_ASSISTANT_WORDS from 300 to 150 in self-contained signal.
- **Rationale:** Single-topic conversations that stay coherent throughout still benefit from segmentation at natural sub-topic breaks. The 300-word threshold was too restrictive for shorter but structured assistant responses.

### D4: Title artifact stripping
- **Decision:** Apply `stripLeadingArtifacts()` in `tryCleanedSentence()`, `cleanHeadingText()`, and `cleanComparisonSide()`.
- **Rationale:** Em-dashes and unicode punctuation were leaking into titles because these strategies lacked the normalization pass.

### D5: Unbalanced bracket cleanup
- **Decision:** Add `cleanUnbalancedBrackets()` post-processing to `truncateAtWord()`.
- **Rationale:** Truncation at word boundaries can cut inside parenthetical expressions, leaving dangling `(` or `)` in titles.

## Phase 3

_(To be filled during Phase 3)_

## Phase 4

_(To be filled during Phase 4)_
