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

### D6: Question filtering strategy
- **Decision:** Add `isLikelyQuestion()` gate requiring `?` ending, question-word start, or request phrasing. Non-questions are excluded from the Questions Asked callout.
- **Rationale:** Statements like "Government fees (couple):" were appearing as questions. Explicit question detection prevents this.

### D7: Topic fragment filtering
- **Decision:** Add `isConversationalFragment()` filter rejecting entries starting with acknowledgments (got it, great, thanks, etc.) and entries under 20 chars. Applied to both heading-extracted and fallback topics.
- **Rationale:** Conversational fragments like "Got it -- couple (2 adults)" are not meaningful topics.

### D8: Takeaway quality gates
- **Decision:** Restrict TAKEAWAY_PATTERNS matching to first 60 chars of sentence, filter conversational filler, require at least 3 words of 4+ chars.
- **Rationale:** Broad patterns like `\boverall\b` matched random sentences when the keyword appeared deep in long sentences. The prefix restriction + informativeness check reduces false positives.

### D9: Ollama timeout
- **Decision:** Wrap `requestUrl()` in `Promise.race` with 120s timeout.
- **Rationale:** Ollama requests can hang indefinitely on slow models or network issues. 120s is generous enough for large prompts.

### D10: tsconfig cleanup
- **Decision:** Remove `inlineSourceMap` and `inlineSources` from tsconfig.json.
- **Rationale:** These settings have no effect when `noEmit: true` since TypeScript produces no output files.

## Phase 4

### D11: CHANGELOG format
- **Decision:** Keep-a-Changelog style with features listed under 0.1.0.
- **Rationale:** Standard format recognized by Obsidian community. Lists all major features for initial release.
