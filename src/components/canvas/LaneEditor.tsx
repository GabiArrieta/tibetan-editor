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
 * Visual constraint:
 * - Tibetan and phonetic lanes are single-line (white-space: nowrap) so that each
 *   row acts as a "frame" of the continuous flow. Text that does not fit is clipped
 *   and should be split into a new row via Enter or smart paste.
 * - Translation lane allows wrapping (white-space: pre-wrap) because translations
 *   are often longer than a single visual line.
 */

import React, { useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import type { LaneKey, TextStyle } from '../../types/document'
import { useDocumentStore } from '../../store/documentStore'
import { useEditorStore } from '../../store/editorStore'
import { normaliseClipboardText } from '../../lib/operations/importParser'

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

    // Enter → split row at cursor
    if (e.key === 'Enter' && !e.shiftKey) {
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

    // Split on any combination of CR/LF, filter out blank lines
    const lines = normalised.split(/\r?\n/).filter(l => l.length > 0)

    if (lines.length <= 1) {
      // Single-line paste: insert at cursor as before
      document.execCommand('insertText', false, normalised)
    } else {
      // Multi-line paste: distribute across rows
      const offset = ref.current ? getCaretOffset(ref.current) : 0
      onMultiLinePaste(offset, lines)
    }
  }, [onMultiLinePaste])

  // Tibetan and phonetic lanes are single-line: long text is clipped rather than
  // wrapped within the row so each row acts as one "frame" of the continuous flow.
  // Translation is allowed to wrap since translations are often multi-line.
  const laneStyle: React.CSSProperties = {
    ...textStyleToCss(style),
    whiteSpace: lane === 'translation' ? 'pre-wrap' : 'nowrap',
    overflow: lane === 'translation' ? 'visible' : 'hidden',
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
