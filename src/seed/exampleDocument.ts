/**
 * Example seed document with real Tibetan text, phonetics and translation.
 *
 * This document demonstrates the three-lane structure with multiple rows
 * and blocks. It can be loaded via File → Load or used as a default.
 */

import { v4 as uuid } from 'uuid'
import type { TibetanDocument } from '../types/document'
import {
  DEFAULT_PAGE_SETTINGS,
  DEFAULT_TIBETAN_STYLE,
  DEFAULT_PHONETIC_STYLE,
  DEFAULT_TRANSLATION_STYLE,
  DEFAULT_ROW_LAYOUT,
  DEFAULT_BLOCK_LAYOUT,
} from '../types/document'

const now = new Date().toISOString()

function makeRow(tibetan: string, phonetic: string, translation: string) {
  return {
    id: uuid(),
    tibetan: { text: tibetan, style: { ...DEFAULT_TIBETAN_STYLE } },
    phonetic: { text: phonetic, style: { ...DEFAULT_PHONETIC_STYLE } },
    translation: { text: translation, style: { ...DEFAULT_TRANSLATION_STYLE } },
    layout: { ...DEFAULT_ROW_LAYOUT },
  }
}

export const exampleDocument: TibetanDocument = {
  id: uuid(),
  title: 'Ejemplo — Corazón de la Prajnaparamita',
  createdAt: now,
  updatedAt: now,
  pageSettings: { ...DEFAULT_PAGE_SETTINGS },
  fontRegistry: [],
  stylePresets: [],
  blocks: [
    {
      id: uuid(),
      label: 'Título',
      rows: [
        makeRow(
          'བཅོམ་ལྡན་འདས་མ་ཤེས་རབ་ཀྱི་ཕ་རོལ་ཏུ་ཕྱིན་པའི་སྙིང་པོ།',
          "bcom ldan 'das ma shes rab kyi pha rol tu phyin pa'i snying po",
          'El corazón de la perfección de la sabiduría de la bienaventurada'
        ),
      ],
      layout: { ...DEFAULT_BLOCK_LAYOUT, marginBottomPt: 24 },
    },
    {
      id: uuid(),
      label: 'Verso 1 — Aspiración',
      rows: [
        makeRow(
          'བཀྲ་ཤིས་བདེ་ལེགས།',
          'tashi delek',
          'Que haya auspicio y bienestar'
        ),
        makeRow(
          'སེམས་ཅན་ཐམས་ཅད་བདེ་བར་གྱུར་ཅིག།',
          "sem chen tham ché de war gyur chik",
          'Que todos los seres sintientes alcancen la felicidad'
        ),
        makeRow(
          'སྡུག་བསྔལ་ཐམས་ཅད་དང་བྲལ་བར་གྱུར་ཅིག།',
          "duk ngel tham ché dang dral war gyur chik",
          'Que todos sean libres del sufrimiento'
        ),
      ],
      layout: { ...DEFAULT_BLOCK_LAYOUT },
    },
    {
      id: uuid(),
      label: 'Verso 2 — Sunyata',
      rows: [
        makeRow(
          'གཟུགས་སྟོང་པའོ།།',
          "zuk tong pa'o",
          'La forma es vacuidad'
        ),
        makeRow(
          'སྟོང་པ་ཉིད་གཟུགས་སོ།།',
          'tong pa nyi zuk so',
          'La vacuidad es forma'
        ),
        makeRow(
          'གཟུགས་ལས་སྟོང་པ་ཉིད་གཞན་མ་ཡིན།',
          'zuk lé tong pa nyi zhen ma yin',
          'La vacuidad no es diferente de la forma'
        ),
        makeRow(
          'སྟོང་པ་ཉིད་ལས་གཟུགས་གཞན་མ་ཡིན་ནོ།།',
          'tong pa nyi lé zuk zhen ma yin no',
          'La forma no es diferente de la vacuidad'
        ),
      ],
      layout: { ...DEFAULT_BLOCK_LAYOUT },
    },
  ],
}
