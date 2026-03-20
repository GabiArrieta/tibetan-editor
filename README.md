# Tibetan Editor

Editor editorial profesional para textos multilínea sincronizados con tres carriles: Tibetano, Fonética y Traducción.

## Objetivo

Herramienta de maquetación orientada a la producción de textos tibetanos con su transliteración fonética y traducción, mantenidos como unidades estructurales sincronizadas, con salida A4 en PDF y DOCX.

## Características

- **Editor estructurado custom**: tres carriles independientes (tibetano / fonética / traducción) por fila, sincronizados estructuralmente
- **Canvas A4 real**: previsualización exacta en mm con zoom configurable
- **Soporte de fuentes tibetanas custom**: carga de `.ttf`, `.otf`, `.woff`, `.woff2` desde el disco del usuario, almacenadas localmente en IndexedDB
- **Importación masiva**: pegar tres bloques de texto y generar filas sincronizadas automáticamente, con detección de desbalances
- **Exportación PDF**: via `@react-pdf/renderer`, motor de layout propio (yoga), con fuentes embebidas
- **Exportación DOCX**: via `docx`, estructura fiel con estilos de párrafo
- **Guardado/carga JSON**: formato de proyecto propio (`.tibetan.json`)
- **Autosave**: cada 30 segundos en `localStorage`
- **Propiedades por fila**: control fino de gaps, márgenes, offsets, interlineado, fuente

## Stack técnico

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Framework | Vite + React 18 + TypeScript | Cliente puro, sin SSR, preparado para Tauri |
| Estado | Zustand + Immer | Mutaciones profundas sin boilerplate |
| UI | Tailwind CSS | Utilidades precisas, sin CSS-in-JS overhead |
| Persistencia de fuentes | IndexedDB (idb) | Almacenamiento binario persistente en browser |
| Export PDF | @react-pdf/renderer | Motor yoga propio, fuentes custom, layout controlado |
| Export DOCX | docx v9 | Programático, browser-compatible, sin servidor |

## Instalación

```bash
# Requiere Node.js >= 18
cd tibetan-editor
npm install
npm run dev
```

La aplicación se abre en `http://localhost:5173`.

## Uso rápido

1. **Cargar ejemplo**: la primera vez se carga el documento de ejemplo con texto tibetano del Corazón de la Prajnaparamita
2. **Importar texto**: `Ctrl+I` → pegar los tres bloques → vista previa → confirmar
3. **Editar**: hacer clic en cualquier carril y escribir. `Enter` divide la fila, `Tab` navega entre carriles
4. **Fuentes custom**: panel derecho → "Fuentes" → cargar `.ttf` o `.woff`
5. **Exportar**: `Ctrl+P` para PDF, botón DOCX en la barra superior
6. **Guardar**: `Ctrl+S` descarga un archivo `.tibetan.json`

## Atajos de teclado

| Atajo | Acción |
|-------|--------|
| `Ctrl+S` | Guardar proyecto (descarga JSON) |
| `Ctrl+P` | Exportar PDF |
| `Ctrl+I` | Abrir importador de texto |
| `Ctrl+D` | Duplicar fila seleccionada |
| `Ctrl+Delete` | Eliminar fila seleccionada |
| `Alt+↑` / `Alt+↓` | Mover fila arriba/abajo |
| `Ctrl++` / `Ctrl+-` | Zoom in / Zoom out |
| `Ctrl+0` | Restablecer zoom |
| `Enter` (en carril) | Dividir fila en posición del cursor |
| `Tab` / `Shift+Tab` | Navegar entre carriles de la misma fila |

## Estructura del proyecto

```
src/
├── types/          # Tipos TypeScript del modelo de datos
├── store/          # Zustand stores (document, editor, fonts)
├── components/
│   ├── canvas/     # DocumentCanvas, PageView, BlockView, RowView, LaneEditor
│   ├── layout/     # AppShell, TopBar, LeftSidebar, RightPanel
│   ├── panels/     # RowPropertiesPanel, DocumentPropertiesPanel, FontManagerPanel
│   ├── import/     # ImportAssistant
│   └── shared/     # Button, NumberInput
├── lib/
│   ├── pdf/        # PdfDocument, pdfExport
│   ├── docx/       # docxExport
│   ├── fonts/      # fontStorage (IDB), fontLoader (CSS), fontValidation
│   ├── pagination/ # paginationEngine
│   ├── persistence/# projectIO (save/load JSON)
│   └── operations/ # importParser
├── hooks/          # useKeyboardShortcuts
└── seed/           # exampleDocument (texto tibetano de muestra)
```

## Formato del archivo de proyecto

Los proyectos se guardan como `.tibetan.json`. Ver [docs/data-model.md](docs/data-model.md) para la especificación completa.

**Importante**: los archivos de fuentes NO se incluyen en el JSON. Solo se guarda la metadata. Los binarios viven en `IndexedDB` del navegador. Si abrís el proyecto en otro navegador o máquina, necesitás volver a cargar los archivos de fuente.

## Fuentes tibetanas

La app es completamente extensible en cuanto a fuentes. No hay fuentes tibetanas incluidas (por razones de licencia). Podés cargar cualquier fuente `.ttf` o `.woff` desde el panel "Fuentes".

Recursos de fuentes tibetanas gratuitas:
- **Tibetan Machine Uni** (disponible en Namgyal Institute y otros)
- **DDC Uchen** (Digital Dharma)
- **Jomolhari** (disponible en varios repositorios)

Para export PDF se recomienda usar `.ttf` o `.woff`. Los archivos `.otf` pueden tener compatibilidad reducida con `@react-pdf/renderer`.

## Roadmap

**Fase 2** (próxima):
- Drag & drop de filas y bloques (dnd-kit)
- Panel de ajustes finos por fila
- Style presets
- Undo/redo con historial
- Preview PDF embebido

**Fase 3**:
- Autosave robusto con historial de versiones
- Plantillas de documento
- Validación de glifos (detectar caracteres no cubiertos por la fuente)
- Empaquetado desktop con Tauri
- Tests E2E con Playwright

## Documentación técnica

- [docs/architecture.md](docs/architecture.md) — decisiones arquitectónicas, flujo de datos, pipeline de exportación
- [docs/data-model.md](docs/data-model.md) — modelo de datos, tipos TypeScript, ejemplos JSON
