# Text Flow Debug Report

## Symptoms Observed

| Lane | Observed behaviour |
|---|---|
| Tibetan | Pasted text stayed on one line; further pastes accumulated invisibly. Wrapping never happened. |
| Phonetic | Similar to Tibetan: text clipped at right edge, subsequent pastes invisible. |
| Translation | Worked better — text visually wrapped within the same row. But it did not advance to the next block automatically. |

When Spanish text was pasted into the Tibetan lane it appeared to "work" because Latin characters share a common `word-break` model that browsers apply by default even under `nowrap`. Tibetan Unicode was not given any opportunity to break, so everything accumulated on a single invisible overflow line.

---

## Root Cause Analysis

### RC-1 — `white-space: nowrap; overflow: hidden` made text invisible

**File:** `src/components/canvas/LaneEditor.tsx` (previously lines 220–221)

```ts
// OLD — culprit
whiteSpace: lane === 'translation' ? 'pre-wrap' : 'nowrap',
overflow:   lane === 'translation' ? 'visible'  : 'hidden',
```

The design intention was that each row acts as a "single-line frame" and text that overflows should not be visible — instead it should be split into new rows. The problem: the split only happened when the user explicitly pressed Enter or pasted multi-line text. Pasting a single long line of Tibetan text filled the row's hidden overflow; no automatic split occurred; focus never advanced; and every subsequent paste appended more invisible text to the same row.

**Why Tibetan and not Spanish?**
Latin uses `word-break` / space characters as natural break opportunities. `nowrap` prevents wrapping but text is still measurable. With `overflow: hidden` Latin text is clipped at the border and some is visible up to the boundary — this made it look like it "worked."

Tibetan, however, is written with tsek (་ U+0F0B) as the primary word separator. The Unicode line-break algorithm assigns tsek the class **BA (Break After)**, which means a browser _can_ wrap at tsek — but only when `white-space` is not `nowrap`. With `nowrap` the entire Tibetan string becomes one unbreakable unit, and `overflow: hidden` then hides everything beyond the container width. The user saw the first few characters, then nothing.

### RC-2 — rAF race condition stole focus back after paste

**File:** `src/components/canvas/LaneEditor.tsx` — `useEffect([text])` (previously lines 127–135)  
**File:** `src/components/canvas/RowView.tsx` — `handleMultiLinePaste`

When a paste was dispatched:
1. `LaneEditor`'s `useEffect([text])` ran (because `text` prop changed after the store updated).
2. Inside that effect, `hadFocus` was `true` (the element had focus at paste time).
3. A `requestAnimationFrame` (rAF-A) was scheduled to **restore the caret inside the current lane**.
4. `handleMultiLinePaste` in `RowView` also scheduled a `requestAnimationFrame` (rAF-B) to **advance focus to the next row**.

These two rAFs competed. When rAF-A ran after rAF-B, focus was pulled back to the original lane. The next Ctrl+V pasted into the same (already-invisible) row again.

### RC-3 — No explicit Ctrl+Enter shortcut

Users expected Ctrl+Enter to create a new row of the same lane (advance downward explicitly). The existing Enter handler fired on Ctrl+Enter too (because it only tested `!shiftKey`), but the intent was unclear and some IME / OS combinations handle Ctrl+Enter differently before the browser sees it.

---

## Evidence from Code

### CSS (`LaneEditor.tsx`)

The style object that applied `nowrap + hidden` was the exclusive controller of the lane's wrapping behaviour — no other CSS overrode it. `src/index.css` had `white-space: pre-wrap` on `.lane-editor` but it was overridden by the inline style.

### Paste path (verified in `RowView.tsx` and `LaneEditor.tsx`)

`handlePaste` in `LaneEditor.tsx` always calls `onMultiLinePaste(lines)`, including for single-line pastes. `handleMultiLinePaste` in `RowView.tsx` calls `distributeLaneAcrossRows` (store action) and then schedules a single rAF to advance focus. The rAF from `useEffect` in the same tick competed and sometimes won.

### Tibetan Unicode line-break behaviour

Per [Unicode TR#14](https://unicode.org/reports/tr14/), U+0F0B (TIBETAN MARK INTERSYLLABIC TSHEG, "tsek") has line-break class **BA**, which means: allow a line break _after_ this character. Browsers implement this correctly — wrapping does happen at tsek when `white-space` is `normal` or `pre-wrap`. No custom segmentation, `word-break: break-all`, or `Intl.Segmenter` is needed for display-level wrapping.

---

## Differences Between Scripts Explained

| Script | Default break opportunity | Behaviour with `nowrap` | Behaviour with `overflow:hidden` |
|---|---|---|---|
| Latin | Space (U+0020, LB class SP) | No wrap, but text measured | Text clipped; some visible |
| Tibetan | Tsek (U+0F0B, LB class BA) | No wrap, whole string = one unit | Entire string hidden after clip |
| Phonetic | Space (usually Latin diacritics) | Similar to Latin | Clipped; some visible |

This explains why Translation (which had `pre-wrap`) worked better and why Tibetan appeared completely "stuck".
