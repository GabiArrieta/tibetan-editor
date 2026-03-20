# Text Frame Capacity Model

## Conceptual Model

Each **row/block** in the document contains three **frames** — one per lane:

```
┌─────────────────────────────────┐ ← Block (row)
│  [Tibetan frame  ──────────────]│  ← width W, height H_tibetan (1 line)
│  [gap]                          │
│  [Phonetic frame ──────────────]│  ← width W, height H_phonetic (1 line)
│  [gap]                          │
│  [Translation frame ──────────]│  ← width W, height H_translation (≤4 lines)
└─────────────────────────────────┘
```

Frames of the **same lane type** are linked across consecutive blocks:

```
Block 1                 Block 2                 Block 3
[Tibetan frame 1] ──→ [Tibetan frame 2] ──→ [Tibetan frame 3]
[Phonetic frame 1] ──→ [Phonetic frame 2] ──→ [Phonetic frame 3]
[Translation fr.1] ──→ [Translation fr.2] ──→ [Translation fr.3]
```

When pasting text, the paste pipeline **measures** how much fits in the current frame and distributes the overflow to successive frames automatically.

## Frame Dimensions

### Width

Frame width = `containerEl.clientWidth` — the actual pixel width of the lane editor div at paste time.

This is the correct width because:
- It accounts for the block's padding, indentation, and any page margin set on the row layout.
- It uses the already-rendered DOM, so margins applied via `rowStyle` in `RowView.tsx` are already factored in.

### Height

Frame height is fixed by CSS in `LaneEditor.tsx`:

| Lane | Height rule | CSS applied |
|---|---|---|
| Tibetan | Exactly 1 visual line | `height: fontSize × lineHeight × PT_TO_PX` |
| Phonetic | Exactly 1 visual line | `height: fontSize × lineHeight × PT_TO_PX` |
| Translation | Up to 4 visual lines | `maxHeight: fontSize × lineHeight × PT_TO_PX × 4` |

### Overflow behaviour

`overflow: hidden` — any content that exceeds the frame height is clipped, not wrapped onto a new visible line. Since paste pre-splits content, clipping should only happen if:
- A user types manually (beyond one line) without pressing Enter.
- A single token (one Tibetan syllable or one long word) is wider than the frame — in that case it is assigned anyway (can't break sub-token).

## Measurement Algorithm

The measurement is performed by `splitTextToFitFrames` in `src/lib/operations/textFit.ts`.

### Tokenisation

```
Lane: tibetan
Text: "བཀྲ་ཤིས་བདེ་ལེགས།བཀྲ་ཤིས་"
Tokens: ["བཀྲ་", "ཤིས་", "བདེ་", "ལེགས།", "བཀྲ་", "ཤིས་"]

Lane: phonetic/translation
Text: "tashi delek gewa dang"
Tokens: ["tashi ", "delek ", "gewa ", "dang"]
```

### Greedy line-filling with DOM width measurement

```
measure_el = hidden div (same font styles as lane editor)
measure_el.style.whiteSpace = 'nowrap'

current_line = ""
lines = []

for token in tokens:
    candidate = current_line + token
    measure_el.textContent = candidate
    if measure_el.scrollWidth <= frame_width:
        current_line = candidate
    else:
        if current_line != "":
            lines.push(current_line)
            current_line = token
        else:
            lines.push(token)  # single oversized token — must include
            current_line = ""

if current_line:
    lines.push(current_line)
```

**Time complexity**: O(n) where n = token count. One DOM write per token. Typical paste (<200 tokens) takes <5 ms.

## Distribution

After `splitTextToFitFrames` returns `["chunk1", "chunk2", ..., "chunkN"]`, the paste handler calls:

```
onMultiLinePaste(cursorOffset, ["chunk1", "chunk2", ..., "chunkN"])
```

Which calls `distributeLaneAcrossRows(blockId, rowId, lane, offset, lines)` in `documentStore.ts`:

- `lines[0]` → current row's lane (at cursor position)
- `lines[1]` → next row in the document (next block if needed)
- `lines[N]` → N-th consecutive row; new blocks created if document doesn't have enough rows

## Editing After Paste

Once text is distributed, each frame contains its assigned chunk. The user can:

| Action | Result |
|---|---|
| **Enter** / **Ctrl+Enter** in a lane | Split the row at cursor — creates new row in same block |
| **ArrowDown** at end | Move to next row's same lane |
| **Backspace** at start | Merge current row onto previous row's lane |
| **Manual typing** | Text grows within frame; if it exceeds 1 line, it's clipped (user must split with Enter) |

## Edge Cases

| Scenario | Behaviour |
|---|---|
| Single very long Tibetan syllable wider than frame | Token assigned to its own frame as-is; may be clipped on right edge |
| Font not yet loaded at paste time | Measurement uses fallback font metrics; may be slightly off; repasting after font loads gives correct split |
| Very narrow frame (e.g. narrow page or large font) | Each token (syllable/word) gets its own frame |
| Empty paste | No-op |
| Text with mixed script | Tokenised as-is; Tibetan tsek still acts as break point |
