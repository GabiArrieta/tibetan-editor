# Linked Lane Overflow — Plan

## What the Previous Fix Resolved

The RC-1/2/3 fix (CSS + rAF) resolved:
- **Invisible text**: `white-space: nowrap; overflow: hidden` was silently hiding Tibetan text beyond the frame width.
- **Focus race condition**: `useEffect`'s rAF stole focus back after paste, causing successive Ctrl+V to paste into the same row.
- **Ctrl+Enter shortcut**: Explicit shortcut for splitting a row.

## What It Did NOT Resolve

The fundamental structural problem remained:

> When a long piece of text is pasted, the entire text lands in **one single row/block**, growing that row's height indefinitely.
> The text does not distribute to the next block's corresponding lane.

This is because:
1. The paste pipeline split text only on **explicit newlines** (`\n`).  
   A single-line paste (no newlines) was treated as a single chunk → one row.
2. There was no **visual capacity measurement**: the system had no way to know that a chunk of text exceeded what fits in one frame.

## New Problem Framing: Structural Overflow

Each lane in each block is a **frame** — a rectangular container of finite width. Text that does not fit in frame N must overflow to frame N+1 of the **same lane** in the next block.

This is analogous to InDesign's "linked text frames". The difference is that our frames are not pixel-based page layout, but structural editing units (rows/blocks).

### Why the Row Was Growing Indefinitely

```
White-space: normal + overflow: visible
→ lane editor grows in height without bound
→ user sees a tall block but text is "inside" the block, not distributed
```

The row was autoexpanding because:
- CSS `white-space: normal` allowed wrapping
- No `height` or `maxHeight` constrained the frame
- The paste pipeline put the entire text into one row

## The Fix

### 1. Text-Fit Measurement (`src/lib/operations/textFit.ts`)

A new `distributeTextAcrossFrames(text, lane, el)` function:
1. Tokenizes text by natural break points:
   - Tibetan: after tsek (་) or shad (།)
   - Latin: after spaces
2. Greedily fills tokens into "lines" by measuring `scrollWidth` against the lane's `clientWidth` using a hidden measurement div.
3. Returns an array of strings — one per frame — that each fit within the container width.

### 2. Paste Pipeline Update (`LaneEditor.tsx` → `handlePaste`)

```
OLD: text → split on \n → N lines → distributeLaneAcrossRows(N lines)
NEW: text → split on \n → paragraphs
               → for each paragraph: splitTextToFitFrames() → M chunks
               → flatten → distributeLaneAcrossRows(M chunks)
```

This means even a single-line paste (no `\n`) is measured and split into as many rows as needed for it to fit frame-by-frame.

### 3. Fixed Frame Height (`LaneEditor.tsx` → `laneStyle`)

```typescript
// Tibetan/phonetic: exactly ONE line tall
height: `${fontSize * lineHeight * PT_TO_PX}px`
whiteSpace: 'nowrap'
overflow: 'hidden'

// Translation: up to 4 lines
maxHeight: `${fontSize * lineHeight * PT_TO_PX * 4}px`
whiteSpace: 'pre-wrap'
overflow: 'hidden'
```

This prevents the frame from growing vertically. Any text that doesn't fit is clipped — but since paste now pre-splits, clipping should only occur if the user manually types more than fits (they can split with Enter).

## Expected Behavior After Fix

| Action | Before | After |
|---|---|---|
| Paste long Tibetan text | All text in one block, row grows tall | Text distributed one-segment-per-block across consecutive blocks |
| Paste short Tibetan snippet repeatedly | All snippets accumulate in same row (focus didn't advance) | Each snippet goes to the next block's tibetan lane |
| Paste multi-paragraph text | Each paragraph → one row (but still too long) | Each paragraph → multiple rows based on fit |
| Manual typing | Row grows | Clipped at one line; Enter splits to next row |

## Remaining Limitations

1. **Font loading race**: Measurement uses the computed font at paste time. If a custom Tibetan font is still loading (async via `@font-face`), measurements may be slightly off for the first paste. Subsequent pastes after the font is loaded will be correct.

2. **Manual typing overflow**: If a user types more than fits in a frame without pressing Enter, the text is clipped (not auto-distributed). This is by design — auto-distribution during typing would be disruptive. Press Enter or Ctrl+Enter to split.

3. **Edit-time reflow**: After editing the middle of a flow, rows are not automatically rebalanced. This would require a full layout engine (like InDesign's compose). The current model is "compose on paste, edit manually thereafter."

4. **Translation frames**: Translation lane allows up to 4 lines. If a translation is longer, it clips. The user should split with Enter.
