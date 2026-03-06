# Gap Analysis: Paste Detection System

## Background

The paste detection system was originally simple: check for explicit speaker labels (`You said:` / `ChatGPT said:` for ChatGPT, `Human:` / `Assistant:` for Claude), and fall back to markdown. It worked because labeled pastes are unambiguous.

Three features were added over time that introduced complexity:
1. **Claude web paste detection** (commit `944b503`) -- date-stamp based detection for Claude's web copy format
2. **Heading-based document splitting** (commit `b2cefd7`) -- splits markdown on headings into document sections
3. **Unlabeled ChatGPT heuristic** (commit `1b70e36`) -- score-based structural detection for ChatGPT paste without labels

Each addition tried to handle a real gap, but they interact in ways that create cross-contamination. Two subsequent fix attempts (`c759821`, `e0b3328`) oscillated between breaking Claude detection and breaking ChatGPT detection.

---

## Current Detection Architecture

There are **two independent detection paths** that can disagree:

### Path 1: `detectFormat()` (format-detector.ts) -- sets UI badge

```
1. isJson()              -> chatgpt/claude file-json
2. isChatGPTPaste()      -> chatgpt paste (requires "You said:" + "ChatGPT said:" labels)
3. isClaudePaste()       -> claude paste  (requires "Human:" + "Assistant:" labels)
4. isClaudeWebPaste()    -> claude paste  (requires 2+ standalone date stamps like "Jan 5")
5. isLikelyChatGPTPaste() -> chatgpt paste (heuristic: headings, bold, numbered items, disclaimers)
6. fallback              -> markdown paste
```

### Path 2: `parseInput()` parser chain (index.ts) -- determines actual parsing

```
1. ChatGPTPasteParser.canParse()  (same logic as isChatGPTPaste)
2. ClaudePasteParser.canParse()   (same logic as isClaudePaste)
3. ClaudeWebParser.canParse()     (same logic as isClaudeWebPaste)
4. MarkdownParser.canParse()      (always returns true -- fallback)
```

### Path 3: Inside MarkdownParser.parse() -- a third detection layer

```
1. detectSpeakerPattern()     -> checks 4 markdown heading patterns (## User, #### You:, etc.)
2. isLikelyChatGPTPaste()     -> calls format-detector heuristic again
   -> parseAsInferredChat()   -> role inference by section length/structure
3. splitBySections()          -> heading-based document splitting (all role: 'user')
4. splitByParagraphGroups()   -> paragraph grouping fallback
5. single message             -> entire input as one message
```

### The Disagreement Problem

`detectFormat()` and the parser chain run the same checks redundantly but can produce different outcomes. The badge can show "chatgpt (paste)" while MarkdownParser actually handles the content. More critically, the MarkdownParser has its OWN internal detection tree that adds a third layer of decision-making.

---

## Active Bugs

### Bug 1: Unlabeled ChatGPT paste still detected as "Document"

**Symptom:** Pasting a ChatGPT conversation without speaker labels (TEST_PASTE_CONVERSATION_2.md) shows "Document" badge and parses as 178 document sections.

**Root cause:** `isLikelyChatGPTPaste()` scoring is miscalibrated. The heuristic requires score >= 3 from structural patterns (headings, bold lines, numbered bold, disclaimers). The content doesn't have enough of these specific patterns to reach the threshold, even though it contains "Thought for" markers that unambiguously identify it as ChatGPT.

**Even if the heuristic fires**, `parseAsInferredChat()` has its own failure mode: if all sections are classified as the same role (everything is "assistant" because it's all structured content), they merge into 1 message, which fails the `>= 2` check and falls back to document mode anyway.

### Bug 2: Claude web paste misdetected as ChatGPT

**Symptom:** A Claude web paste (with date stamps) is detected as "chatgpt (paste)" instead of "claude (paste)".

**Root cause:** Commit `c759821` added heading guards to Claude detection that blocked legitimate Claude paste. This was reverted in `e0b3328`, but the underlying issue is that structural heuristics can't distinguish ChatGPT from Claude output.

### Bug 3: `parseAsInferredChat()` role inference is unreliable

**Root cause:** The `inferRole()` method uses word count + structure signals but heading-based section boundaries don't align with actual role boundaries, causing all sections to classify as the same role.

---

## Structural Issues

### Issue 1: Three layers of detection with no shared state
`detectFormat()`, parser `canParse()`, and `MarkdownParser.parse()` all independently detect the format with no shared state.

### Issue 2: Heuristic detection has no negative signals
`isLikelyChatGPTPaste()` only scores positive structural signals that all AI assistants and well-formatted markdown share.

### Issue 3: The "unlabeled paste" problem is not solvable with structure heuristics
ChatGPT, Claude, and markdown documents all use the same structural elements. There is no structural pattern that reliably distinguishes them. But ChatGPT has a unique **content-based** marker: "Thought for X" lines, which Claude and markdown never produce.

### Issue 4: Document splitting is destructive for misclassified content
When unlabeled ChatGPT paste falls to `splitBySections()`, it creates 178 sections all with `role: 'user'` and `contentType: 'document'`, cascading into over-segmentation, no assistant-based title strategies, and identical tags.

---

## Recommended Fix

### A: Remove fragile heuristic
Delete `isLikelyChatGPTPaste()` and `parseAsInferredChat()`. These use unreliable structural signals.

### B: Add "Thought for" as high-confidence ChatGPT signal
"Thought for X" (e.g. "Thought for 25s", "Thought for 1m 43s") is unique to ChatGPT. It appears in unlabeled paste (TEST_PASTE_CONVERSATION_2.md) as a natural boundary between user questions and assistant responses. Use it for both detection and parsing.

### C: Add user source override
A dropdown in the import modal (Auto / ChatGPT / Claude / Document) handles edge cases where no automatic signal exists (e.g., unlabeled paste without "Thought for" lines).

---

## Regression Timeline

| Commit | Date | What Changed | What Broke |
|--------|------|-------------|------------|
| `2d0f522` | Feb 14 | Initial parsers: label-only detection | Nothing (simple, correct) |
| `b2cefd7` | Feb 18 | Heading-based document splitting in MarkdownParser | Unlabeled ChatGPT paste now splits into 178 sections instead of 1 message |
| `944b503` | Feb 24 | `isClaudeWebPaste` added to format-detector | Nothing directly |
| `95a23f4` | Feb 24 | ClaudeWebParser registered in parser chain | Nothing directly |
| `1b70e36` | Mar 5 | `isLikelyChatGPTPaste` heuristic + `parseAsInferredChat` | Heuristic doesn't fire for the test paste; introduces false positive risk |
| `c759821` | Mar 5 | Heading guard added to `isClaudeWebPaste` | Claude web paste with headings misdetected |
| `e0b3328` | Mar 5 | Guard removed, date-stamp exclusion added to heuristic | ChatGPT paste still falls to Document |
