/**
 * LaneEditor — a single editable text lane (tibetan / phonetic / translation).
 *
 * Uses a contenteditable div so that:
 * - Cursor stays within this lane's scope
 * - Unicode Tibetan pastes correctly
 * - We can intercept keyboard events to implement structural operations
 *
 * Key behaviours:
 * - Enter              → split row at cursor (structural operation, not a newline)
 * - Tab / Shift+Tab    → move focus to next / previous lane within the same row
 * - ArrowDown at end   → move focus to next row's same lane
 * - ArrowUp at start   → move focus to previous row's same lane
 * - Backspace at pos 0 → merge this row with the previous row (continuous flow)
 * - Paste (single line) → inserts text at cursor (existing behaviour)
 * - Paste (multi-line)  → distributes lines across consecutive rows (new behaviour)
 *
 * Visual layout:
 * - All lanes use white-space: normal / overflow: visible so text is always visible.
 * - Tibetan and phonetic wrap at tsek (་ U+0F0B, Unicode LB class BA) automatically.
 * - Translation uses pre-wrap to honour explicit newlines.
 * - Each row can be multi-line; Enter / Ctrl+Enter split to a new row explicitly.
 */

import React, { useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import type { LaneKey, TextStyle } from '../../types/document'
import { useDocumentStore } from '../../store/documentStore'
import { useEditorStore } from '../../store/editorStore'
import { normaliseClipboardText } from '../../lib/operations/importParser'
import { distributeTextAcrossFrames } from '../../lib/operations/textFit'

interface LaneEditorProps {
  blockId: string
  rowId: string
  lane: LaneKey
  text: string
  style: TextStyle
  /** Called when the user presses Enter (requests a row split) */
  onSplitRequest(cursorOffset: number): void
  /** Called to move focus to adjacent lane within the same row */
  onNavigate(direction: 'next' | 'prev'): void
  /**
   * Called when the user pastes multi-line text.
   * lines[0] replaces the text from cursor onwards in this row;
   * lines[1..N] are distributed into new rows inserted after this one.
   */
  onMultiLinePaste(cursorOffset: number, lines: string[]): void
  /** Called when ArrowDown is pressed at the end of the lane */
  onNavigateRow(direction: 'next' | 'prev'): void
  /** Called when Backspace is pressed at position 0 (merge with prev row) */
  onMergeWithPrev(): void
  readOnly?: boolean
}

function textStyleToCss(style: TextStyle): React.CSSProperties {
  return {
    fontFamily: style.fontFamily,
    fontSize: `${style.fontSize}pt`,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}pt` : undefined,
    color: style.color ?? '#111',
    textAlign: style.textAlign ?? 'left',
    fontWeight: style.fontWeight ?? 400,
    fontStyle: style.fontStyle ?? 'normal',
  }
}

/** Get cursor offset (character count from start) within a contenteditable element */
function getCaretOffset(el: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return 0
  const range = sel.getRangeAt(0)
  const preRange = range.cloneRange()
  preRange.selectNodeContents(el)
  preRange.setEnd(range.endContainer, range.endOffset)
  return preRange.toString().length
}

/** Return true if the caret is at the very end of the element's text */
function isCaretAtEnd(el: HTMLElement): boolean {
  const offset = getCaretOffset(el)
  return offset >= (el.textContent?.length ?? 0)
}

/** Return true if the caret is at position 0 */
function isCaretAtStart(el: HTMLElement): boolean {
  return getCaretOffset(el) === 0
}

const PT_TO_PX = 1.3333 // 1pt ≈ 1.333px at 96dpi

const LANE_LABELS: Record<LaneKey, string> = {
  tibetan: 'Tibetano',
  phonetic: 'Fonética',
  translation: 'Traducción',
}

export const LaneEditor = React.memo(function LaneEditor({
  blockId,
  rowId,
  lane,
  text,
  style,
  onSplitRequest,
  onNavigate,
  onMultiLinePaste,
  onNavigateRow,
  onMergeWithPrev,
  readOnly = false,
}: LaneEditorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const updateLaneText = useDocumentStore(s => s.updateLaneText)
  const setFocusedLane = useEditorStore(s => s.setFocusedLane)
  const selectRow = useEditorStore(s => s.selectRow)

  // Sync external text changes into the DOM without losing cursor
  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    if (el.textContent !== text) {
      const sel = window.getSelection()
      let offset = 0
      let hadFocus = false
      if (document.activeElement === el && sel && sel.rangeCount > 0) {
        hadFocus = true
        offset = getCaretOffset(el)
      }
      el.textContent = text
      if (hadFocus) {
        requestAnimationFrame(() => {
          // If focus has moved elsewhere (e.g. handleMultiLinePaste advanced to the
          // next row), do not steal it back.
          if (document.activeElement !== el) return
          const node = el.firstChild
          if (node) {
            const range = document.createRange()
            const clampedOffset = Math.min(offset, node.textContent?.length ?? 0)
            range.setStart(node, clampedOffset)
            range.collapse(true)
            sel?.removeAllRanges()
            sel?.addRange(range)
          }
        })
      }
    }
  }, [text])

  const handleInput = useCallback(() => {
    if (!ref.current) return
    const newText = ref.current.textContent ?? ''
    updateLaneText(blockId, rowId, lane, newText)
    useEditorStore.getState().setDirty(true)
  }, [blockId, rowId, lane, updateLaneText])

  const handleFocus = useCallback(() => {
    setFocusedLane({ blockId, rowId, lane })
    selectRow({ blockId, rowId })
  }, [blockId, rowId, lane, setFocusedLane, selectRow])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return

    // Enter / Ctrl+Enter → split row at cursor (create new row, same lane continues below)
    // Both plain Enter and Ctrl+Enter split the row so users can explicitly advance to
    // the next row of the same lane regardless of whether they use the modifier.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSplitRequest(getCaretOffset(el))
      return
    }
    // Explicit Ctrl+Enter alias — browsers may handle Enter+ctrl differently in some
    // OS / IME combinations, so we intercept it here too for safety.
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onSplitRequest(getCaretOffset(el))
      return
    }

    // Tab → navigate between lanes within the same row
    if (e.key === 'Tab') {
      e.preventDefault()
      onNavigate(e.shiftKey ? 'prev' : 'next')
      return
    }

    // ArrowDown at end of content → move to next row's same lane
    if (e.key === 'ArrowDown' && isCaretAtEnd(el)) {
      e.preventDefault()
      onNavigateRow('next')
      return
    }

    // ArrowUp at start of content → move to previous row's same lane
    if (e.key === 'ArrowUp' && isCaretAtStart(el)) {
      e.preventDefault()
      onNavigateRow('prev')
      return
    }

    // Backspace at position 0 with no selection → merge row with previous
    if (e.key === 'Backspace' && isCaretAtStart(el)) {
      const sel = window.getSelection()
      const hasSelection = sel && !sel.isCollapsed
      if (!hasSelection) {
        e.preventDefault()
        onMergeWithPrev()
        return
      }
    }
  }, [onSplitRequest, onNavigate, onNavigateRow, onMergeWithPrev])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const raw = e.clipboardData.getData('text/plain')
    const normalised = normaliseClipboardText(raw)

    // Step 1 — split on explicit newlines
    const paragraphs = normalised.split(/\r\n|\r|\n|\u2028|\u2029/).filter(l => l.length > 0)
    if (paragraphs.length === 0) return

    // Step 2 — for each paragraph, further split by visual fitting in the current
    // frame. This is the key structural overflow fix: long single-line text (e.g.
    // a paragraph of Tibetan with no explicit newlines) is measured against the
    // lane editor's current clientWidth and split into frame-sized chunks.
    // Each chunk becomes one row in the document, distributed by distributeLaneAcrossRows.
    const el = ref.current
    const allFrameLines: string[] = []
    for (const para of paragraphs) {
      const fitted = distributeTextAcrossFrames(para, lane, el)
      allFrameLines.push(...fitted)
    }

    const offset = el ? getCaretOffset(el) : 0
    onMultiLinePaste(offset, allFrameLines)
  }, [onMultiLinePaste, lane])

  // Frame capacity model:
  // - Tibetan and phonetic are "single-line frames": exactly one visual line tall.
  //   Paste always distributes content so only the fitting portion lands here.
  //   overflow: hidden clips any text that exceeds the frame (e.g. from manual typing)
  //   without growing the row. The user can split with Enter / Ctrl+Enter.
  // - Translation frames allow up to 4 visual lines (translations are often longer).
  //   They use pre-wrap to respect explicit newlines.
  const ONE_LINE_PX = style.fontSize * (style.lineHeight ?? 1.4) * PT_TO_PX
  const laneStyle: React.CSSProperties = {
    ...textStyleToCss(style),
    whiteSpace: lane === 'translation' ? 'pre-wrap' : 'nowrap',
    overflowWrap: 'break-word',
    overflow: 'hidden',
    // Fix the height to exactly one line (tibetan/phonetic) or up to 4 lines (translation)
    height: lane === 'translation' ? undefined : `${ONE_LINE_PX}px`,
    maxHeight: lane === 'translation' ? `${ONE_LINE_PX * 4}px` : undefined,
    // Clip any overflow text — it should have been distributed to the next frame at paste time
    textOverflow: 'clip',
    display: 'block',
  }

  return (
    <div
      className={[
        'lane-wrapper relative group',
        lane === 'tibetan'
          ? 'lane-tibetan'
          : lane === 'phonetic'
          ? 'lane-phonetic'
          : 'lane-translation',
      ].join(' ')}
    >
      {/* Lane label shown on hover / focus */}
      <span
        className="absolute -left-14 top-0 text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity leading-none pt-[2px] pointer-events-none select-none"
        aria-hidden="true"
      >
        {LANE_LABELS[lane]}
      </span>

      <div
        ref={ref}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        className="lane-editor w-full"
        style={laneStyle}
        onInput={handleInput}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-lane={lane}
        data-row-id={rowId}
        data-block-id={blockId}
        aria-label={`${LANE_LABELS[lane]}: fila ${rowId}`}
        role="textbox"
        aria-multiline={lane === 'translation' ? 'true' : 'false'}
        spellCheck={lane !== 'tibetan'}
      />
    </div>
  )
})
