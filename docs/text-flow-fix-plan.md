# Text Flow Fix Plan

## Overview

Three confirmed root causes; three targeted fixes. No architectural rebuild required.

---

## Fix 1 — CSS: Allow text wrapping in all lanes

**Status:** Implemented  
**File:** `src/components/canvas/LaneEditor.tsx`  
**File:** `src/index.css`

### Change

```ts
// BEFORE
whiteSpace: lane === 'translation' ? 'pre-wrap' : 'nowrap',
overflow:   lane === 'translation' ? 'visible'  : 'hidden',

// AFTER
whiteSpace: lane === 'translation' ? 'pre-wrap' : 'normal',
overflowWrap: 'break-word',
overflow: 'visible',
```

Also removed `white-space: pre-wrap` from the `.lane-editor` CSS rule in `src/index.css` (redundant; now controlled solely by inline style on the `div`).

### Rationale

- Tibetan wraps at tsek (་ U+0F0B, Unicode LB class BA) natively — no custom logic needed.
- `overflow: visible` ensures text is never silently clipped.
- `overflowWrap: break-word` provides a last-resort break for long phonetic strings without natural break points.
- Translation already used `pre-wrap`; unchanged.

### Expected result

Pasting any amount of Tibetan text into a lane makes it visually fill the row and wrap downward, fully visible. The user sees the content and can decide to split it into the next row with Enter / Ctrl+Enter.

---

## Fix 2 — rAF race: `useEffect` must not steal focus after paste

**Status:** Implemented  
**Files:** `src/components/canvas/LaneEditor.tsx`, `src/components/canvas/RowView.tsx`

### Part A — Guard in `LaneEditor.tsx` `useEffect`

```ts
requestAnimationFrame(() => {
  if (document.activeElement !== el) return  // ← focus already moved; do not steal it
  // ...restore caret as before
})
```

If `handleMultiLinePaste` has already moved focus to the next row before this rAF fires, the guard bails out and the caret restore does not happen.

### Part B — Double-rAF in `RowView.tsx` `handleMultiLinePaste`

The focus-advance is now wrapped in a nested `requestAnimationFrame`:

```ts
requestAnimationFrame(() => {        // outer — same frame as useEffect's rAF
  // ...compute next row...
  requestAnimationFrame(() => {      // inner — fires AFTER useEffect's rAF
    focusLane(next.blockId, next.rowId, lane)
    setFocusedLane(...)
  })
})
```

This guarantees the focus-advance always fires _after_ `useEffect`'s rAF has run (and been neutralised by the guard in Part A).

### Why both are needed

- Part A alone: if the outer rAF in RowView fires first, useEffect's rAF can still steal focus in the next frame.
- Part B alone: the inner rAF still races with useEffect's rAF if the guard is absent.
- Together: deterministic — focus lands on the next row every time.

---

## Fix 3 — Ctrl+Enter splits row explicitly

**Status:** Implemented  
**File:** `src/components/canvas/LaneEditor.tsx`

```ts
if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
  e.preventDefault()
  onSplitRequest(getCaretOffset(el))
  return
}
```

The existing plain-`Enter` handler already intercepts Ctrl+Enter (because it only tested `!shiftKey`), but the explicit handler is added for clarity and to guard against IME / OS combinations that pre-process Ctrl+Enter before the keydown event reaches the browser.

---

## Limitations and Known Constraints

| Item | Notes |
|---|---|
| Multi-line rows | Tibetan/phonetic lanes now wrap and can be multi-line. A row is no longer guaranteed to be one visual line. This is intentional — users split rows manually with Enter when they want synchronisation boundaries. |
| Automatic frame overflow | Text does NOT automatically reflow from one row to the next when a row "fills up". The structural flow is driven by explicit Enter / paste-distribute. This matches the "Structural Flow" model documented in `docs/continuous-flow-refactor.md`. |
| Tibetan line-break quality | Wrapping happens at tsek characters. This is correct for standard Tibetan. Texts without tsek (e.g. transliterated labels) will use `overflowWrap: break-word` as a fallback, which may break in the middle of a syllable — visually acceptable but not linguistically ideal. |
| IME compositions | Ctrl+Enter during active IME composition may not fire reliably. Users should complete the IME candidate before pressing Ctrl+Enter. |

---

## Next Steps (not in scope of this fix)

1. **Auto-advance caret to end of row after wrapping text** — currently after a long paste the caret may end up in the middle of the now-visible text. A UX improvement would place it at the end.
2. **Height synchronisation** — now that lanes can be multi-line, the row height must expand to fit the tallest lane. The current flex layout should handle this, but edge cases with very tall translation rows may need `align-items: start` tuning.
3. **Export fidelity** — `@react-pdf/renderer` uses Yoga layout independently of the browser; wrapped Tibetan text in the editor now matches the visual layout but PDF output depends on the font metrics registered with `Font.register`. Verify with a Tibetan font that the PDF wraps at the same boundaries.
