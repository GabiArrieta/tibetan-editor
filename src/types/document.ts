/**
 * Core document model types.
 * These types define the complete data structure of a TibetanDocument project.
 * The JSON serialisation of this model is the save file format.
 */

export type PageSize = 'A4' | 'Letter' | 'custom'
export type TextAlign = 'left' | 'center' | 'right'
export type FontStyle = 'normal' | 'italic'
export type FontRole = 'tibetan' | 'phonetic' | 'translation' | 'ui'
export type FontFormat = 'ttf' | 'woff' | 'woff2' | 'otf'
export type LaneKey = 'tibetan' | 'phonetic' | 'translation'

/**
 * Block type discriminant.
 * 'content'         — normal trilingual rows (default)
 * 'cover'           — portada / cover page (uses special.coverData)
 * 'back'            — página final / colophon (uses special.backData)
 * 'index'           — tabla de contenidos (auto-generated)
 * 'section-heading' — título de sección (rendereado con estilo de heading)
 */
export type BlockType = 'content' | 'cover' | 'back' | 'index' | 'section-heading'

// ---------------------------------------------------------------------------
// Page settings
// ---------------------------------------------------------------------------

export interface PageSettings {
  size: PageSize
  /** Page width in millimetres */
  widthMm: number
  /** Page height in millimetres */
  heightMm: number
  marginTopMm: number
  marginRightMm: number
  marginBottomMm: number
  marginLeftMm: number
  showPageNumbers: boolean
  pageNumberPosition: 'bottom-center' | 'bottom-right' | 'bottom-left'
  /** Page number starts counting from this value (default 1) */
  pageNumberStartAt: number
  /** If true, cover page is excluded from numbering (not counted) */
  pageNumberSkipCover: boolean
  header?: string
  footer?: string
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  size: 'A4',
  widthMm: 210,
  heightMm: 297,
  marginTopMm: 20,
  marginRightMm: 20,
  marginBottomMm: 20,
  marginLeftMm: 20,
  showPageNumbers: false,
  pageNumberPosition: 'bottom-center',
  pageNumberStartAt: 1,
  pageNumberSkipCover: true,
}

// ---------------------------------------------------------------------------
// Font registry (metadata only — binaries live in IndexedDB)
// ---------------------------------------------------------------------------

export interface FontEntry {
  id: string
  /** CSS font-family name used throughout the document */
  family: string
  /** Semantic role this font is the default for */
  role: FontRole
  /** Original file name for display purposes */
  fileName: string
  format: FontFormat
  /**
   * Key used to retrieve the ArrayBuffer from IndexedDB.
   * Never embed the binary in the JSON project file.
   */
  storageKey: string
}

// ---------------------------------------------------------------------------
// Style primitives
// ---------------------------------------------------------------------------

export interface TextStyle {
  fontFamily: string
  /** Font size in points */
  fontSize: number
  /** Line height ratio (e.g. 1.4) */
  lineHeight: number
  /** Letter spacing in points */
  letterSpacing?: number
  color?: string
  textAlign?: TextAlign
  /** CSS numeric weight (400, 700 …) */
  fontWeight?: number
  fontStyle?: FontStyle
}

export const DEFAULT_TIBETAN_STYLE: TextStyle = {
  fontFamily: 'serif',
  fontSize: 18,
  lineHeight: 1.5,
  letterSpacing: 0,
  color: '#111111',
  textAlign: 'left',
  fontWeight: 400,
  fontStyle: 'normal',
}

export const DEFAULT_PHONETIC_STYLE: TextStyle = {
  fontFamily: 'serif',
  fontSize: 12,
  lineHeight: 1.4,
  letterSpacing: 0,
  color: '#333333',
  textAlign: 'left',
  fontWeight: 400,
  fontStyle: 'italic',
}

export const DEFAULT_TRANSLATION_STYLE: TextStyle = {
  fontFamily: 'serif',
  fontSize: 11,
  lineHeight: 1.4,
  letterSpacing: 0,
  color: '#222222',
  textAlign: 'left',
  fontWeight: 400,
  fontStyle: 'normal',
}

// ---------------------------------------------------------------------------
// Style presets
// ---------------------------------------------------------------------------

export interface StylePreset {
  id: string
  name: string
  target: LaneKey
  style: TextStyle
}

// ---------------------------------------------------------------------------
// Lane — single text layer within a row
// ---------------------------------------------------------------------------

export interface Lane {
  text: string
  style: TextStyle
}

// ---------------------------------------------------------------------------
// Row layout
// ---------------------------------------------------------------------------

export interface RowLayout {
  /** Vertical gap between tibetan and phonetic lanes, in points */
  gapAfterTibetanPt: number
  /** Vertical gap between phonetic and translation lanes, in points */
  gapAfterPhoneticPt: number
  marginTopPt: number
  marginBottomPt: number
  /** Horizontal offset from normal position */
  offsetXPt: number
  /** Vertical nudge (fine adjustment) */
  offsetYPt: number
  /** If true, the renderer will avoid splitting this row across pages */
  keepTogether: boolean
  paddingLeftPt: number
  paddingRightPt: number
  indentationPt: number
  alignment: TextAlign
  /** Overrides the block/page content width for this specific row */
  widthOverridePt?: number
}

export const DEFAULT_ROW_LAYOUT: RowLayout = {
  gapAfterTibetanPt: 4,
  gapAfterPhoneticPt: 6,
  marginTopPt: 0,
  marginBottomPt: 8,
  offsetXPt: 0,
  offsetYPt: 0,
  keepTogether: true,
  paddingLeftPt: 0,
  paddingRightPt: 0,
  indentationPt: 0,
  alignment: 'left',
}

// ---------------------------------------------------------------------------
// Row — the fundamental structural unit
// ---------------------------------------------------------------------------

export interface Row {
  id: string
  tibetan: Lane
  phonetic: Lane
  translation: Lane
  layout: RowLayout
  /** IDs of comments attached to this row (references commentStore, not serialised inline) */
  commentIds?: string[]
}

// ---------------------------------------------------------------------------
// Block — a logical grouping of rows (e.g. a stanza or section)
// ---------------------------------------------------------------------------

export interface BlockLayout {
  marginTopPt: number
  marginBottomPt: number
  paddingLeftPt: number
  paddingRightPt: number
  /** Overrides page content width for the entire block */
  widthOverridePt?: number
}

export const DEFAULT_BLOCK_LAYOUT: BlockLayout = {
  marginTopPt: 0,
  marginBottomPt: 16,
  paddingLeftPt: 0,
  paddingRightPt: 0,
}

// ---------------------------------------------------------------------------
// Special page data (for cover, back, index blocks)
// ---------------------------------------------------------------------------

export interface CoverPageData {
  title: string
  subtitle?: string
  author?: string
  institution?: string
  additionalText?: string
  /** Supabase Storage path or base64 data URL for the cover image */
  imageUrl?: string
  footerText?: string
}

export interface BackPageData {
  text: string
  /** Optional second text column or additional paragraph */
  secondaryText?: string
}

export interface SectionHeadingData {
  level: 1 | 2 | 3
}

export type SpecialPageData =
  | { type: 'cover'; cover: CoverPageData }
  | { type: 'back'; back: BackPageData }
  | { type: 'index' }
  | { type: 'section-heading'; heading: SectionHeadingData }

export const DEFAULT_COVER_DATA: CoverPageData = {
  title: 'Título del documento',
  subtitle: '',
  author: '',
  institution: '',
  additionalText: '',
  footerText: '',
}

export const DEFAULT_BACK_DATA: BackPageData = {
  text: '',
}

// ---------------------------------------------------------------------------
// Block — a logical grouping of rows (e.g. a stanza or section)
// ---------------------------------------------------------------------------

export interface Block {
  id: string
  /**
   * Block type discriminant. Defaults to 'content' if absent (backward compatible
   * with documents saved before this field was introduced).
   */
  blockType?: BlockType
  /** Optional label shown in the sidebar (not rendered in output for content blocks) */
  label?: string
  rows: Row[]
  layout: BlockLayout
  /** Populated only for non-content block types */
  special?: SpecialPageData
}

// ---------------------------------------------------------------------------
// Top-level document
// ---------------------------------------------------------------------------

/**
 * Optional per-lane source text for the "continuous flow" model.
 *
 * Each field stores the full text of one lane as pasted or imported by the
 * user — newline-separated, one segment per line. The rows[] array is the
 * canonical segmented representation used for editing and rendering; flowContent
 * is a reference buffer that enables re-sync and provides a "whole flow" view.
 *
 * This field is fully optional and backward-compatible: documents saved before
 * this field was introduced load normally with flowContent === undefined.
 */
export interface FlowContent {
  tibetan?: string
  phonetic?: string
  translation?: string
}

export interface TibetanDocument {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  pageSettings: PageSettings
  /**
   * Font metadata. Binaries are stored separately in IndexedDB.
   * Keys map to IndexedDB via FontEntry.storageKey.
   */
  fontRegistry: FontEntry[]
  stylePresets: StylePreset[]
  blocks: Block[]
  /**
   * Optional raw source text per lane, used as a reference buffer for the
   * continuous-flow editing model. Not used directly for rendering.
   */
  flowContent?: FlowContent
}
