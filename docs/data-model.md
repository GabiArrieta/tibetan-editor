# Modelo de datos — Tibetan Editor

## Jerarquía

```
TibetanDocument
├── id: string
├── title: string
├── createdAt: string (ISO 8601)
├── updatedAt: string (ISO 8601)
├── pageSettings: PageSettings
├── fontRegistry: FontEntry[]     ← metadata sólo; binarios en IndexedDB
├── stylePresets: StylePreset[]
└── blocks: Block[]
    └── Block
        ├── id: string
        ├── label?: string
        ├── layout: BlockLayout
        └── rows: Row[]
            └── Row
                ├── id: string
                ├── tibetan: Lane
                ├── phonetic: Lane
                ├── translation: Lane
                └── layout: RowLayout
                    └── Lane
                        ├── text: string
                        └── style: TextStyle
```

---

## Tipos TypeScript

### `TibetanDocument`

```typescript
interface TibetanDocument {
  id: string
  title: string
  createdAt: string        // ISO 8601
  updatedAt: string        // ISO 8601
  pageSettings: PageSettings
  fontRegistry: FontEntry[]
  stylePresets: StylePreset[]
  blocks: Block[]
}
```

### `PageSettings`

```typescript
interface PageSettings {
  size: 'A4' | 'Letter' | 'custom'
  widthMm: number          // 210 para A4
  heightMm: number         // 297 para A4
  marginTopMm: number
  marginRightMm: number
  marginBottomMm: number
  marginLeftMm: number
  showPageNumbers: boolean
  pageNumberPosition: 'bottom-center' | 'bottom-right' | 'bottom-left'
  header?: string
  footer?: string
}
```

Valores por defecto A4: 210 × 297 mm, márgenes 20 mm.

### `FontEntry` (metadata — binario en IndexedDB)

```typescript
interface FontEntry {
  id: string
  family: string           // CSS font-family name
  role: 'tibetan' | 'phonetic' | 'translation' | 'ui'
  fileName: string         // nombre original del archivo
  format: 'ttf' | 'woff' | 'woff2' | 'otf'
  storageKey: string       // clave en IndexedDB para recuperar el binario
}
```

> Los archivos binarios se almacenan en `IndexedDB` bajo la clave `storageKey`.  
> El JSON del proyecto NUNCA incluye los bytes de la fuente.

### `Row`

```typescript
interface Row {
  id: string
  tibetan: Lane
  phonetic: Lane
  translation: Lane
  layout: RowLayout
}
```

### `Lane`

```typescript
interface Lane {
  text: string
  style: TextStyle
}
```

### `TextStyle`

```typescript
interface TextStyle {
  fontFamily: string
  fontSize: number         // puntos (pt)
  lineHeight: number       // ratio (ej: 1.4)
  letterSpacing?: number   // puntos
  color?: string           // hex color
  textAlign?: 'left' | 'center' | 'right'
  fontWeight?: number      // 400, 700, etc.
  fontStyle?: 'normal' | 'italic'
}
```

### `RowLayout`

```typescript
interface RowLayout {
  gapAfterTibetanPt: number    // espacio entre tibetano y fonética
  gapAfterPhoneticPt: number   // espacio entre fonética y traducción
  marginTopPt: number
  marginBottomPt: number
  offsetXPt: number            // desplazamiento horizontal fine-tune
  offsetYPt: number            // desplazamiento vertical fine-tune
  keepTogether: boolean        // evitar corte de página
  paddingLeftPt: number
  paddingRightPt: number
  indentationPt: number
  alignment: 'left' | 'center' | 'right'
  widthOverridePt?: number     // sobreescribir ancho del bloque/página
}
```

---

## Ejemplo JSON completo

```json
{
  "id": "doc-abc123",
  "title": "Corazón de la Prajnaparamita",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "pageSettings": {
    "size": "A4",
    "widthMm": 210,
    "heightMm": 297,
    "marginTopMm": 20,
    "marginRightMm": 20,
    "marginBottomMm": 20,
    "marginLeftMm": 20,
    "showPageNumbers": false,
    "pageNumberPosition": "bottom-center"
  },
  "fontRegistry": [
    {
      "id": "font-uuid-1",
      "family": "Jomolhari",
      "role": "tibetan",
      "fileName": "jomolhari.ttf",
      "format": "ttf",
      "storageKey": "font-9f3a1b2c"
    }
  ],
  "stylePresets": [],
  "blocks": [
    {
      "id": "block-uuid-1",
      "label": "Verso 1",
      "layout": {
        "marginTopPt": 0,
        "marginBottomPt": 16,
        "paddingLeftPt": 0,
        "paddingRightPt": 0
      },
      "rows": [
        {
          "id": "row-uuid-1",
          "tibetan": {
            "text": "གཟུགས་སྟོང་པའོ།།",
            "style": {
              "fontFamily": "Jomolhari",
              "fontSize": 18,
              "lineHeight": 1.5,
              "letterSpacing": 0,
              "color": "#111111",
              "textAlign": "left",
              "fontWeight": 400,
              "fontStyle": "normal"
            }
          },
          "phonetic": {
            "text": "zuk tong pa'o",
            "style": {
              "fontFamily": "Gentium Plus",
              "fontSize": 12,
              "lineHeight": 1.4,
              "color": "#333333",
              "textAlign": "left",
              "fontWeight": 400,
              "fontStyle": "italic"
            }
          },
          "translation": {
            "text": "La forma es vacuidad",
            "style": {
              "fontFamily": "serif",
              "fontSize": 11,
              "lineHeight": 1.4,
              "color": "#222222",
              "textAlign": "left",
              "fontWeight": 400,
              "fontStyle": "normal"
            }
          },
          "layout": {
            "gapAfterTibetanPt": 4,
            "gapAfterPhoneticPt": 6,
            "marginTopPt": 0,
            "marginBottomPt": 8,
            "offsetXPt": 0,
            "offsetYPt": 0,
            "keepTogether": true,
            "paddingLeftPt": 0,
            "paddingRightPt": 0,
            "indentationPt": 0,
            "alignment": "left"
          }
        }
      ]
    }
  ]
}
```

---

## Invariantes del modelo

1. Todo documento tiene al menos un `Block`
2. Todo `Block` tiene al menos un `Row`
3. Todo `Row` tiene exactamente tres `Lane` (tibetan, phonetic, translation)
4. El texto de una `Lane` puede ser vacío pero el objeto `Lane` siempre existe
5. `FontEntry.storageKey` es la única referencia al binario — nunca base64 en el JSON
6. Los IDs son UUIDs v4 generados en cliente

---

## Versioning del formato

El formato actual es v1 (implícito). Para versiones futuras se agrega un campo `"version": 1` al nivel raíz del documento. La lógica de carga verifica este campo y aplica migraciones si es necesario.

---

## Almacenamiento de fuentes (IndexedDB)

Base de datos: `tibetan-editor-fonts`  
Object store: `font-binaries`  
Clave: `FontEntry.storageKey` (string UUID)  
Valor: `ArrayBuffer` (bytes del archivo de fuente)

```
IndexedDB
└── tibetan-editor-fonts (v1)
    └── font-binaries
        ├── "font-9f3a1b2c" → ArrayBuffer (Jomolhari.ttf bytes)
        ├── "font-4d2e9b1a" → ArrayBuffer (Gentium.woff bytes)
        └── ...
```

La app limpia entradas huérfanas (sin correspondencia en `fontRegistry`) al cargar un proyecto.
