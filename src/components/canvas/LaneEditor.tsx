/**
 * LaneEditor — a single editable text lane (tibetan / phonetic / translation).
 *
 * Uses a contenteditable div so that:
 * - Cursor stays within this lane's scope
 * - Unicode Tibetan pastes correctly
 * - We can intercept keyboard events to implement structural operations
 *
 * Key behaviours:
 * - Enter → split row at cursor (structural operation, not a newline)
 * - Tab → move focus to the next lane in the same row
 * - Shift+Tab → move focus to the previous lane
 * - The lane text is read from the store and pushed back on change
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
  /** Called to move focus to adjacent lane */
  onNavigate(direction: 'next' | 'prev'): void
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

/** Get cursor offset within a contenteditable element */
function getCaretOffset(el: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return 0
  const range = sel.getRangeAt(0)
  const preRange = range.cloneRange()
  preRange.selectNodeContents(el)
  preRange.setEnd(range.endContainer, range.endOffset)
  return preRange.toString().length
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
      // Only update DOM if the content actually differs (avoid cursor jump)
      const sel = window.getSelection()
      let offset = 0
      let hadFocus = false
      if (document.activeElement === el && sel && sel.rangeCount > 0) {
        hadFocus = true
        offset = getCaretOffset(el)
      }
      el.textContent = text
      if (hadFocus) {
        // Restore cursor after external update
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const offset = ref.current ? getCaretOffset(ref.current) : 0
      onSplitRequest(offset)
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      onNavigate(e.shiftKey ? 'prev' : 'next')
    }
  }, [onSplitRequest, onNavigate])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const raw = e.clipboardData.getData('text/plain')
    const normalised = normaliseClipboardText(raw)
    // Insert at cursor position
    document.execCommand('insertText', false, normalised)
  }, [])

  return (
    <div
      className={[
        'lane-wrapper relative group',
        lane === 'tibetan' ? 'lane-tibetan' : lane === 'phonetic' ? 'lane-phonetic' : 'lane-translation',
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
        style={textStyleToCss(style)}
        onInput={handleInput}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-lane={lane}
        data-row-id={rowId}
        data-block-id={blockId}
        aria-label={`${LANE_LABELS[lane]}: fila ${rowId}`}
        role="textbox"
        aria-multiline="false"
        spellCheck={lane !== 'tibetan'}
      />
    </div>
  )
})
