# Tibetan Editor — Plan de Refinamiento (Fase 2)

## 1. Auditoría del estado actual

### Fortalezas de la base actual

- **Modelo de datos sólido**: La jerarquía `Document → Block → Row → Lane` es correcta y extensible.
- **Separación binarios / metadata**: Las fuentes van a IndexedDB, el JSON del proyecto no lleva binarios. Decisión correcta.
- **Zustand + Immer**: El patrón de mutaciones es limpio y consistente en todo el store.
- **LaneEditor**: El modelo de `contenteditable` con control explícito de Enter/Tab es el enfoque correcto para este editor estructurado.
- **Supabase Auth**: Flujo completo (email/password, magic link, signup) correctamente implementado.
- **cloudSync**: Upsert por `id` funciona. La vista `accessible_documents` con RLS es correcta.

### Deuda técnica detectada

| Severidad | Problema | Archivo |
|-----------|----------|---------|
| 🔴 Alta | Tab entre lanes usa selector CSS roto (`[A][B] .child` en vez de `[A][B][child]`) | `RowView.tsx` |
| 🔴 Alta | Enter después de split no hace focus a la nueva fila | `RowView.tsx` |
| 🔴 Alta | `keepTogether` en paginación es no-op (`void keepTogether`) | `paginationEngine.ts` |
| 🔴 Alta | Todo el documento renderiza en una sola página PDF | `PdfDocument.tsx` |
| 🔴 Alta | No hay undo/redo | `editorStore.ts` |
| 🟡 Media | `loadFontsForDocument` no se llama al cargar doc de la nube | `DocumentBrowser.tsx` |
| 🟡 Media | `saveDocumentToCloud` escribe `owner_id` en cada upsert (podría robar ownership) | `cloudSync.ts` |
| 🟡 Media | Font family en panel de propiedades es campo libre, no dropdown de fuentes registradas | `RowPropertiesPanel.tsx` |
| 🟡 Media | `ImportAssistant` llama `loadDocument()` directamente, saltando el action layer | `ImportAssistant.tsx` |
| 🟡 Media | `isDirty` se activa inmediatamente al cargar el documento de ejemplo | `AppShell.tsx` |
| 🟡 Media | `confirm()` y `alert()` nativos bloquean el render | `AppShell.tsx`, `TopBar.tsx` |
| 🟢 Baja | `StylePreset` no tiene UI (definido pero huérfano) | `documentStore.ts` |
| 🟢 Baja | `FontRole = 'ui'` no tiene efecto | `types/document.ts` |
| 🟢 Baja | `laneRefs` en RowView es código muerto | `RowView.tsx` |

---

## 2. Objetivos de esta fase

### Prioridad 1 — Persistencia y multi-proyecto
- Soporte para múltiples proyectos dentro de la misma app
- Persistencia local (localStorage) y cloud (Supabase)
- Browser de proyectos en el sidebar

### Prioridad 2 — Comentarios editoriales
- Sistema de comentarios por fila/lane
- UI para crear, ver, resolver, eliminar comentarios
- Persistencia en Supabase (tabla `comments`)

### Prioridad 3 — Páginas especiales
- Portada (`blockType: 'cover'`): título, subtítulo, autor, imagen, pie
- Página final (`blockType: 'back'`): colofón / créditos
- Numeración de páginas configurable (desde qué página, posición, skip portada)

### Prioridad 4 — Índice / tabla de contenidos
- Generación automática a partir de bloques con `blockType: 'section-heading'`
- Actualizable manualmente

### Prioridad 5 — Corrección de sincronización de líneas
- Fix Tab navigation (selector CSS roto)
- Fix Enter focus post-split
- Comportamiento claro de Backspace al inicio de lane

---

## 3. Decisiones técnicas

### Multi-proyecto
**Decisión**: Un `Project` es metadata + uno o más `TibetanDocument`. En fase inicial 1 proyecto = 1 documento (simplifica UX). Proyectos listados en sidebar izquierda o modal de apertura.

**Persistencia local**: `localStorage['te:projects']` almacena lista de `ProjectMeta[]`. Cada documento se guarda en `localStorage['te:doc:${id}']`.

**Persistencia cloud**: Tabla `projects` en Supabase + documentos ya existentes enlazados por `project_id`.

### Comentarios
**Decisión**: Los comentarios se asocian a una `Row` (no a un rango de texto exacto como Google Docs). El anclaje de texto es "best-effort": se guarda el texto del lane en el momento de crear el comentario, pero si el texto cambia, el comentario queda asociado a la fila sin anclaje de texto preciso.

**Razón**: El anclaje de rangos de texto en `contenteditable` requiere un modelo de texto estructurado (como Yjs/ProseMirror) para ser robusto. Para esta fase, la asociación a fila es suficiente para uso editorial real.

**Formato**: Los comentarios se almacenan en un `commentStore` separado del document store. Esto permite:
- Comentarios independientes del snapshot del documento
- Fácil filtrado y resolución
- Sincronización incremental con Supabase sin re-enviar el documento completo

### Páginas especiales (cover/back)
**Decisión**: Se modelan como `Block` con `blockType: 'cover' | 'back' | 'index'`. Los bloques de tipo especial tienen un campo `special?: SpecialPageData` con sus propios datos estructurados.

**Razón**: Reutiliza el sistema de bloques existente. No requiere un tipo de página paralelo. La portada aparece en la posición 0 del array `blocks`.

### No implementamos en esta fase
- Colaboración realtime (Supabase Realtime/Yjs): requiere CRDTs o OT. Documentado como fase futura.
- Undo/redo global: requiere command pattern o Immer patches. Documentado como deuda técnica prioritaria.
- PDF multi-página correcta: requiere refactor de `PdfDocument.tsx`. Documentado pero no es bloqueante para deploy.

---

## 4. Roadmap de fases

### Fase A (actual sprint)
- [x] Auditoría y documentación
- [x] Extensión del modelo de datos
- [x] Fix bugs críticos (Tab, Enter focus)
- [x] Multi-proyecto (store + UI básica)
- [x] Comentarios (store + panel)
- [x] Páginas especiales (cover, back, numeración)
- [x] Schema Supabase v2

### Fase B (siguiente sprint)
- [ ] Undo/redo (Immer patches o Zustand `temporal`)
- [ ] PDF multi-página real
- [ ] Índice/TOC generado automáticamente
- [ ] Drag & drop de filas y bloques (dnd-kit)
- [ ] Font family dropdown en panel de propiedades
- [ ] Presets de estilo con UI

### Fase C (futuro)
- [ ] Colaboración realtime (Supabase Realtime + optimistic updates)
- [ ] Presencia de usuarios (cursors, quién está editando)
- [ ] Historial de versiones de documento
- [ ] Templates de documentos
- [ ] Validación de glifos tibetanos
- [ ] Desktop packaging (Tauri)

---

## 5. Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Licencias de fuentes tibetanas en cloud storage | Legal | Warning explícito en UI, opt-in manual |
| PDF single-page con documentos largos | Funcional | Documentado; workaround: exportar DOCX |
| `confirm()` nativo bloquea UI en móvil | UX | Reemplazar con modales Radix en Fase B |
| RLS de Supabase no probada con edge cases | Seguridad | Tests de RLS en staging antes de prod |
| Sin undo/redo: pérdida accidental de trabajo | UX | Autosave cada 30s + backup a localStorage |
