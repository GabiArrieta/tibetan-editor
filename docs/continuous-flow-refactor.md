# Tibetan Editor — Continuous Flow Refactor

## Status: IMPLEMENTED

---

## 1. Diagnosis: What the original model got wrong

The editor stores text in a `Document → Block → Row → Lane` hierarchy where each `Lane` carries its own independent `text: string`. This is structurally correct, but three editing behaviors made the model feel like a collection of closed boxes instead of a continuous flow:

### Problem 1: Paste did not split into rows

`LaneEditor.handlePaste` normalised the pasted text and then called `document.execCommand('insertText')`, which dumped all pasted content — including newlines — as a single blob into one row's `contenteditable` div. Pasting 30 lines of Tibetan produced one gigantic row with 30 internal line breaks instead of 30 separate rows.

### Problem 2: Rows were visually closed (no line constraint)

Each `LaneEditor` was a `contenteditable` div with default browser wrapping. A long Tibetan verse would wrap visually *inside* the row. Because the phonetic and translation lanes did not adapt to match the visual wrapping, the three lanes became misaligned. There was no signal to the user that they had written more content than fits in one "frame."

### Problem 3: No cross-row keyboard navigation

There was no `ArrowUp` / `ArrowDown` handler to move the cursor to the previous or next row's matching lane. There was no `Backspace`-at-start handler to merge the current row onto the previous one. Every row was a keyboard island.

---

## 2. Why InDesign-style linked text frames were rejected

The user described the goal using the metaphor of InDesign's linked text frames: text that visually overflows one frame automatically continues in the next frame based on pixel measurements.

This approach was evaluated and rejected for three reasons:

1. **Tibetan syllable boundaries are linguistic, not visual.** A verse cannot be split in the middle of a syllable cluster. Any automatic overflow point would require linguistic awareness of the script.

2. **Three flows at different rates.** Tibetan text is typically much shorter per verse than its translation. If all three flows reflowed independently based on their frame width, the visual row alignment would break — row 1's Tibetan could correspond to a different semantic unit than row 1's translation.

3. **Implementation cost vs. benefit.** Pixel-accurate text measurement in the browser requires canvas-based binary search per frame, continuous ResizeObserver callbacks, and a dedicated layout engine. For liturgical Tibetan texts — which are pre-segmented into verses — this adds enormous complexity for no practical gain.

---

## 3. The correct mental model: Structural Flow

Each row is one **linguistic unit** of the trilingual text:

```
Row 1:  [Tibetan verse 1]  [Phonetic verse 1]  [Translation verse 1]
Row 2:  [Tibetan verse 2]  [Phonetic verse 2]  [Translation verse 2]
Row N:  [Tibetan verse N]  [Phonetic verse N]  [Translation verse N]
```

The "continuous flow" is the sequence of rows. Flow 1 (Tibetan) is `rows[0].tibetan.text + rows[1].tibetan.text + ... + rows[N].tibetan.text`. The rows ARE the frames.

The editor now enforces this model through behavior, not by changing the data structure.

---

## 4. What changed

### `src/types/document.ts`

Added an optional `FlowContent` type and `flowContent?: FlowContent` field to `TibetanDocument`:

```typescript
export interface FlowContent {
  tibetan?: string
  phonetic?: string
  translation?: string
}
```

This stores the raw source text (as originally pasted) for reference and future re-sync operations. It is backward-compatible: existing documents without this field load normally.

### `src/store/documentStore.ts`

Added two new actions:

**`mergeRowWithPrev(blockId, rowId)`**
Concatenates all three lanes' text from `rowId` onto the previous row, then removes `rowId`. Symmetric companion to the existing `mergeRowWithNext`. No-op if `rowId` is the first row in the block.

**`insertRowsAfterFromLines(blockId, rowId, lane, cursorOffset, lines[])`**
Distributes pasted lines across consecutive rows:
- `lines[0]` replaces the current row's lane text (respecting the cursor position — text after the cursor shifts to the last new row)
- `lines[1..N-1]` each get their own new row inserted after the current one
- Returns the ID of the last row in the sequence so the caller can focus it

### `src/components/canvas/LaneEditor.tsx`

**Smart paste** — `handlePaste` now splits pasted text on `\r?\n`:
- Single-line paste: existing `insertText` behavior (no change)
- Multi-line paste: calls `onMultiLinePaste(cursorOffset, lines)` → triggers `insertRowsAfterFromLines`

**Arrow row navigation** — `handleKeyDown` now handles:
- `ArrowDown` when caret is at the end → `onNavigateRow('next')` → focus next row's same lane
- `ArrowUp` when caret is at position 0 → `onNavigateRow('prev')` → focus previous row's same lane

**Backspace merge** — `handleKeyDown` now handles:
- `Backspace` at caret position 0 with no selection → `onMergeWithPrev()` → merges row with previous, restores caret

**Single-line visual constraint**:
- Tibetan and phonetic lanes: `white-space: nowrap; overflow: hidden`
- Translation lane: `white-space: pre-wrap; overflow: visible`

This makes each row's Tibetan and phonetic lanes look like a fixed-width frame. Overflow is a signal that the text should be split into a new row.

### `src/components/canvas/RowView.tsx`

Wired the four new `LaneEditor` props (`onMultiLinePaste`, `onNavigateRow`, `onMergeWithPrev`) with correct focus management:

- `handleMergeWithPrev`: records the previous lane's text length before merging, then places the caret at that exact position after the merge
- `handleNavigateRow`: queries the store for the adjacent row and focuses its lane
- `handleMultiLinePaste`: calls `insertRowsAfterFromLines` and focuses the last created row
- `focusLane` helper now accepts `atEnd` parameter to place the caret at the end of the target lane

---

## 5. New editing behaviors summary

| Action | Before | After |
|---|---|---|
| Paste 30 lines of Tibetan | 1 row with 30 internal newlines | 30 rows, one per line |
| Paste text with newlines | Blob in current row | Each line → own row |
| Paste single line | Insert at cursor | (unchanged) |
| Enter in Tibetan | Split row, new row below | (unchanged) |
| ArrowDown at end of lane | Browser default (no effect beyond current lane) | Move to next row's same lane |
| ArrowUp at start of lane | Browser default | Move to previous row's same lane |
| Backspace at position 0 | Browser default (no row merge) | Merge row onto previous, caret at junction |
| Long Tibetan text in one lane | Visual wrapping within the row | Clipped (overflow hidden) — sign to split into rows |
| Translation text | Wrapping within lane | Wrapping allowed (pre-wrap) |

---

## 6. Cases from the spec, resolved

| Case | Resolution |
|---|---|
| Paste 30 lines of Tibetan | `handlePaste` splits on newlines → `insertRowsAfterFromLines` creates 30 rows |
| Phonetic flow shorter than Tibetan | No issue — each row's lanes are independent; short phonetic leaves an empty lane |
| Translation lines longer than one visual line | Translation lane uses `white-space: pre-wrap`; wraps within its portion of the row |
| Page break mid-document | Rows naturally flow across the A4 preview; pagination engine measures heights |
| Insert text at the beginning | Enter-split creates new rows; Arrow navigation moves through them |
| Delete text mid-flow | Backspace-at-start merges rows; `mergeRowWithNext` / `mergeRowWithPrev` available |

---

## 7. What is unchanged

- The `Row[]` data model — it already correctly encodes the structural flow
- Visual layout of rows (stacked lanes, configurable gaps, A4 preview)
- Block structure, special pages (cover, back, index)
- Export pipeline (PDF, DOCX) — unaffected
- `ImportAssistant` — already handles bulk multi-lane import correctly
- Pagination engine — separate concern; not part of this refactor

---

## 8. Known limitations

- **Overflow not visible**: When a Tibetan lane's text is too long for one row, it is clipped (`overflow: hidden`). The user must manually press Enter or use multi-line paste to create new rows. A future improvement could add a visual indicator (e.g. a faint clipping marker at the right edge).
- **Phonetic and translation are not auto-split on Tibetan Enter**: When you press Enter in the Tibetan lane, only the Tibetan text splits. The phonetic and translation of the new row start empty. This is intentional — the phonetic/translation of the new verse must be entered or pasted separately.
- **`flowContent` is not yet auto-updated**: The `flowContent` field is defined in the data model but not yet automatically kept in sync with row edits. It must be explicitly set via a future "export flow to source" operation.
- **No InDesign-style pixel overflow**: As discussed, this was intentionally rejected. The editor works at the linguistic unit level, not the pixel level.
