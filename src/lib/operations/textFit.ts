/**
 * textFit — DOM-measurement utilities for fitting text into fixed-width frames.
 *
 * The core problem: when pasting long text into a lane, each row/block acts as a
 * "frame" with a finite width. Text that does not fit in one frame must overflow
 * to the next frame of the same lane in the next block.
 *
 * Strategy
 * --------
 * 1. Tokenize the input text at natural break points:
 *    - Tibetan: after tsek (་ U+0F0B) or shad (། U+0F0D)
 *    - Latin (phonetic / translation): after spaces
 * 2. Greedily fill tokens into the current line until adding the next token
 *    would exceed the frame width (measured using a hidden div with identical
 *    font styles as the real lane editor element).
 * 3. Return an array of strings — one per "frame" — that each fit within the
 *    given container width.
 *
 * Performance notes
 * -----------------
 * Measurement is O(n) in token count with one DOM write per token. For a typical
 * paste of 50–200 tokens this is negligible (<5 ms).
 * The hidden element is created and removed within the same synchronous call.
 */

import type { LaneKey } from '../../types/document'

// ---------------------------------------------------------------------------
// Tokenisation
// ---------------------------------------------------------------------------

/**
 * Split text into indivisible units that should not be broken across frames.
 *
 * Tibetan: each syllable ends with tsek (་) or shad (།). We split AFTER those
 * characters so the delimiter stays with the preceding syllable token.
 *
 * Latin (phonetic / translation): split at spaces. The space is kept as a
 * trailing character on the preceding word so it is measured correctly.
 */
export function tokenizeForLane(text: string, lane: LaneKey): string[] {
  if (lane === 'tibetan') {
    const tokens: string[] = []
    let current = ''
    for (const ch of text) {
      current += ch
      // Break AFTER tsek or shad (keep delimiter with preceding syllable)
      if (ch === '\u0F0B' || ch === '\u0F0D') {
        tokens.push(current)
        current = ''
      }
    }
    if (current) tokens.push(current)
    return tokens.length > 0 ? tokens : [text]
  }

  // Phonetic / translation: break at spaces
  const tokens: string[] = []
  let current = ''
  for (const ch of text) {
    if (ch === ' ' && current) {
      tokens.push(current + ' ')
      current = ''
    } else {
      current += ch
    }
  }
  if (current) tokens.push(current)
  return tokens.length > 0 ? tokens : [text]
}

// ---------------------------------------------------------------------------
// Frame-fitting
// ---------------------------------------------------------------------------

/**
 * Split `text` into chunks where each chunk fits within the width of
 * `containerEl` at the element's current font settings.
 *
 * Returns an array of strings. Each string should be assigned to one
 * consecutive frame (row/block) of the same lane.
 *
 * The caller (handlePaste in LaneEditor) must then pass this array to
 * `onMultiLinePaste` / `distributeLaneAcrossRows` so that each chunk lands
 * in a separate row.
 *
 * @param text         Full text to distribute.
 * @param lane         Lane type — determines tokenisation strategy.
 * @param containerEl  The live lane-editor element, used for width + style.
 * @returns            Array of strings, one per frame. Guaranteed ≥ 1 element.
 */
export function splitTextToFitFrames(
  text: string,
  lane: LaneKey,
  containerEl: HTMLElement,
): string[] {
  const maxWidth = containerEl.clientWidth
  if (!text || maxWidth <= 0) return [text]

  // Copy font-related computed styles into a hidden measurement div.
  // We only copy properties relevant to text width; layout props are reset.
  const cs = window.getComputedStyle(containerEl)
  const measure = document.createElement('div')
  measure.style.position = 'absolute'
  measure.style.top = '-9999px'
  measure.style.left = '-9999px'
  measure.style.visibility = 'hidden'
  measure.style.pointerEvents = 'none'
  // Text rendering — must match the lane editor exactly
  measure.style.fontFamily = cs.fontFamily
  measure.style.fontSize = cs.fontSize
  measure.style.fontWeight = cs.fontWeight
  measure.style.fontStyle = cs.fontStyle
  measure.style.letterSpacing = cs.letterSpacing
  measure.style.lineHeight = cs.lineHeight
  // Layout — force single-line measurement; we measure scrollWidth vs maxWidth
  measure.style.whiteSpace = 'nowrap'
  measure.style.width = 'auto'
  measure.style.maxWidth = 'none'
  measure.style.height = 'auto'
  measure.style.overflow = 'visible'
  document.body.appendChild(measure)

  const tokens = tokenizeForLane(text, lane)
  const lines: string[] = []
  let currentLine = ''

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const candidate = currentLine + token

    measure.textContent = candidate
    const fitsInFrame = measure.scrollWidth <= maxWidth

    if (fitsInFrame) {
      currentLine = candidate
    } else {
      if (currentLine) {
        // Commit current line and start a new frame with this token
        lines.push(currentLine)
        currentLine = token

        // Edge case: a single token is already wider than the frame.
        // We must still include it rather than loop infinitely.
        measure.textContent = token
        if (measure.scrollWidth > maxWidth && i === tokens.length - 1) {
          // Last token and it's too wide — push it anyway
          lines.push(token)
          currentLine = ''
        }
      } else {
        // Very first token already overflows the frame — push it as-is
        // (we cannot split sub-token without breaking the word/syllable)
        lines.push(token)
        currentLine = ''
      }
    }
  }

  if (currentLine) lines.push(currentLine)
  document.body.removeChild(measure)

  return lines.length > 0 ? lines : [text]
}

/**
 * High-level helper: takes a paragraph of text (no embedded newlines), splits
 * it into frame-fitting chunks, and returns them.
 *
 * This is the main entry point called from handlePaste in LaneEditor.
 */
export function distributeTextAcrossFrames(
  paragraph: string,
  lane: LaneKey,
  containerEl: HTMLElement | null,
): string[] {
  if (!containerEl || containerEl.clientWidth <= 0) return [paragraph]
  return splitTextToFitFrames(paragraph, lane, containerEl)
}
