# Arquitectura — Tibetan Editor

## Decisión central: Editor estructurado custom

### Por qué NO TipTap / Slate / Lexical

Los editores rich text generalistas (TipTap, Slate, Lexical, ProseMirror) fueron descartados porque:

1. **Modelo de datos incompatible**: su modelo es un árbol de nodos lineales. Los tres carriles sincronizados (tibetano / fonética / traducción) son una estructura *ortogonal* que no mapea a ese modelo.

2. **Comportamiento de teclado incorrecto**: en un editor lineal, `Enter` genera un nuevo párrafo y el cursor puede navegar libremente entre carriles. Esto es exactamente lo que NO queremos: cuando el usuario presiona Enter en el carril tibetano, se debe dividir la *fila estructural*, no crear un párrafo en el flujo lineal.

3. **Export pipeline incompatible**: estos editores no conocen páginas A4 ni bloques sincronizados. Exportar con fidelidad requeriría reescribir el pipeline completo.

4. **Resultado**: implementar los requerimientos sobre un editor generalista habría significado reescribir ~80% de la herramienta para combatir sus abstracciones.

### Solución adoptada: Editor estructurado por componentes

Cada carril (`LaneEditor`) es un `div[contenteditable]` aislado. El cursor no puede escapar a otro carril accidentalmente. La estructura del documento es un array tipado de `Block[]` → `Row[]` → `Lane`, y los componentes React mapean 1:1 a esa estructura.

---

## Estructura del sistema

```
┌─────────────────────────────────────────────────────────┐
│                        AppShell                          │
├──────────┬──────────────────────────────┬───────────────┤
│LeftSide  │      DocumentCanvas          │  RightPanel   │
│bar       │  ┌───────────────────────┐   │ ┌───────────┐ │
│          │  │     PageView (A4)     │   │ │RowProps   │ │
│ Blocks   │  │  ┌─────────────────┐  │   │ │DocProps   │ │
│ └ Rows   │  │  │   BlockView     │  │   │ │FontMgr    │ │
│   └ ...  │  │  │  ┌───────────┐  │  │   │ └───────────┘ │
│          │  │  │  │  RowView  │  │  │   │               │
│          │  │  │  │ tibetan   │  │  │   │               │
│          │  │  │  │ phonetic  │  │  │   │               │
│          │  │  │  │ translat. │  │  │   │               │
│          │  │  │  └───────────┘  │  │   │               │
│          │  │  └─────────────────┘  │   │               │
│          │  └───────────────────────┘   │               │
└──────────┴──────────────────────────────┴───────────────┘
```

---

## Flujo de datos

```
Usuario escribe en LaneEditor
    │
    ▼ onInput event
LaneEditor.handleInput()
    │
    ▼ updateLaneText(blockId, rowId, lane, text)
documentStore (Zustand + Immer)
    │
    ▼ React re-render
RowView / LaneEditor (sincronizados por el store)
    │
    ▼ useEffect (ResizeObserver)
paginationEngine.calculatePageBreaks()
    │
    ▼ setPagination()
editorStore
    │
    ▼ DocumentCanvas re-renders con nuevas páginas
```

---

## Stores

### `documentStore` (Zustand + Immer)
- Fuente de verdad del documento
- Contiene: `TibetanDocument` con todos sus bloques, filas y configuración
- Serializable a JSON (es el formato de guardado)
- Operaciones: CRUD de bloques, filas, carriles; split/merge de filas

### `editorStore` (Zustand plano)
- Estado efímero de UI
- Contiene: selección, zoom, modales abiertos, resultado de paginación, dirty flag
- NO se serializa al JSON del proyecto

### `fontStore` (Zustand plano)
- Estado runtime de fuentes
- Contiene: `LoadedFont[]` con ObjectURLs activos, lista de fuentes faltantes
- Los ObjectURLs son revocados al descargar las fuentes

---

## Pipeline de fuentes custom

```
1. Usuario selecciona archivo .ttf/.woff
        │
        ▼
2. fontValidation.validateFontFile()
   (verifica magic bytes del archivo)
        │
        ▼
3. fontStorage.saveFontBinary()
   (guarda ArrayBuffer en IndexedDB)
        │
        ▼
4. documentStore.addFont()
   (guarda metadata en el documento JSON)
        │
        ▼
5. CSS @font-face injection via ObjectURL
   (para previsualización en el editor)
        │
        ▼
6. Al exportar PDF:
   getFontBinary() → Blob → ObjectURL → Font.register()
```

**Separación de responsabilidades**:
- El JSON del proyecto guarda SOLO metadata: `{ id, family, role, fileName, format, storageKey }`
- Los binarios viven en IndexedDB bajo la clave `storageKey`
- Al cargar un proyecto, si faltan fuentes en IDB → advertencia visible al usuario

---

## Pipeline de exportación PDF

```
exportToPdf(doc)
    │
    ├── Recuperar ObjectURLs de fontStore
    │
    ├── Font.register() para cada fuente custom
    │
    ├── React.createElement(TibetanPdfDocument, { doc })
    │   └── Document > Page > [Block > Row > Lane Text]
    │
    ├── pdf(element).toBlob()
    │   (motor yoga/react-pdf/renderer — sin DOM)
    │
    └── URL.createObjectURL(blob) → a.click() → descarga
```

**Limitaciones documentadas**:
- `@react-pdf/renderer` soporta TTF y WOFF de forma confiable
- OTF puede causar problemas de encoding en Adobe Reader
- La fidelidad de layout pantalla↔PDF puede diferir 1-2pt por diferencias de motor

---

## Pipeline de exportación DOCX

El DOCX no puede replicar el layout de carriles sincronizados de Word nátivamente. Estrategia adoptada:

```
Cada Row → 3 Paragraphs consecutivos:
  ├── Tibetan paragraph (con estilo de fuente correspondiente)
  ├── Phonetic paragraph
  └── Translation paragraph
  └── Empty separator
```

Se respetan: tamaño de página, márgenes, fuentes, interlineado, alineación.  
No se replica: layout preciso de gaps inter-carril, offsets X/Y, sobreescrituras por fila.

---

## Paginación

El motor de paginación (`paginationEngine.ts`) es JavaScript puro — no depende de CSS `@media print`:

1. Construye una lista plana de `RowRef` (references a elementos DOM por ID)
2. Mide la altura real de cada fila con `getBoundingClientRect()`
3. Acumula alturas y compara con `contentHeightPx(doc)` (altura disponible por página)
4. Al detectar overflow, registra un `PageBreak`
5. Respeta `row.layout.keepTogether` para evitar cortes en filas que deben mantenerse unidas
6. El resultado se guarda en `editorStore.pagination` (no en el documento)

Para el MVP, todas las filas se muestran en una página continua. La separación multipágina usa el resultado de paginación para renderizar múltiples `PageView`.

---

## Extensibilidad

La arquitectura está diseñada para crecer:

| Feature futura | Dónde agregar |
|----------------|---------------|
| Drag & drop de filas | `RowView` con `useDraggable` (dnd-kit) |
| Undo/redo | Middleware `temporal` de Zustand sobre `documentStore` |
| Style presets | Ya modelados en `TibetanDocument.stylePresets` |
| Templates | Nuevo módulo `lib/templates/` + UI |
| Validación de glifos | `lib/fonts/glyphChecker.ts` usando fontkit |
| Colaboración | Reemplazar Zustand por CRDT (Yjs) sin cambiar los tipos |
| Desktop (Tauri) | La app es pure-client, compatible sin cambios |
| Server-side PDF | Mover `pdfExport.ts` a un worker/endpoint Node.js |
