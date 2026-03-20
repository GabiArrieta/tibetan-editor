# Tibetan Editor — Checklist Pre-Deploy

## Estado: EN PREPARACIÓN

---

## 🔴 Bloqueantes — No deployar sin resolver

### Configuración de entorno
- [ ] `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` reales (no placeholder)
- [ ] `.env.local` **no** está en el repo (verificar `.gitignore`)
- [ ] Las variables de entorno están cargadas en Vercel (Settings → Environment Variables)

### Supabase
- [ ] Schema SQL ejecutado en el proyecto Supabase (v1 o v2 según corresponda)
- [ ] RLS habilitado en todas las tablas (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] Políticas RLS probadas para al menos dos usuarios distintos
- [ ] `get_user_id_by_email` RPC creado (`supabase/helpers.sql`)
- [ ] Bucket `fonts` creado en Supabase Storage (privado)
- [ ] `Site URL` y `Redirect URLs` configurados en Auth Settings

### Build
- [ ] `npm run build` sin errores TypeScript
- [ ] `npm run lint` sin errores
- [ ] Sin warnings de React sobre `useEffect` dependencies en la build

---

## 🟡 Importantes — Resolver antes de usuarios reales

### Seguridad
- [ ] `saveDocumentToCloud` no envía `owner_id` en updates (solo en insert inicial) — bug actual
- [ ] Validación de inputs en `AuthModal` (evitar HTML injection en email/password)
- [ ] Sin secrets hardcodeados en el código fuente (`grep -r "supabase.co" src/` — solo debe estar en `.env`)
- [ ] Confirmar que las fuentes subidas por usuarios no son accesibles por otros usuarios (RLS de Storage)

### UX crítica
- [ ] Reemplazar `confirm()` y `alert()` nativos por modales Radix en `AppShell.tsx` y `TopBar.tsx`
- [ ] Manejo de error en carga de proyecto de la nube (actualmente: font loading no se llama)
- [ ] Feedback visible después de sign up ("revisá tu correo para confirmar")
- [ ] El indicador de `isDirty` no debe mostrarse en el primer render (solo después de cambios reales del usuario)

### Funcionalidad
- [ ] Tab entre lanes funciona correctamente (selector CSS corregido en esta fase)
- [ ] Enter en lane crea nueva fila y enfoca correctamente
- [ ] Exportar PDF genera archivo descargable sin errores
- [ ] Guardar JSON y cargar el mismo archivo reproduce el documento correctamente
- [ ] Fonts custom cargadas correctamente después de abrir documento de la nube

---

## 🟢 Deseables — Para calidad de producción

### Performance
- [ ] Documentos con 50+ bloques no tienen lag visible en el canvas
- [ ] `ResizeObserver` de paginación no causa thrashing (debounce de 200ms en canvas)
- [ ] Fonts: no se acumulan reglas `@font-face` duplicadas en el DOM

### Errores no manejados
- [ ] IndexedDB no disponible (safari privado, storage quota exceeded) → graceful fallback
- [ ] Supabase offline → indicador de error, autosave a localStorage funciona igual
- [ ] Archivo de proyecto corrupto al cargar → mensaje de error claro, no crash

### Logging
- [ ] Errores de exportación loguean contexto útil (tamaño del documento, fuentes usadas)
- [ ] Errores de cloudSync loguean el error de Supabase (no solo "Error al guardar")
- [ ] Considerar integrar Sentry o similar para errores de producción

### Accesibilidad
- [ ] `lang` attribute en `<html>` (`es` por defecto)
- [ ] Todos los botones tienen `title` o `aria-label`
- [ ] Contraste de colores: texto sobre fondos de sidebar cumple WCAG AA

---

## Deploy en Vercel

### Proceso recomendado

1. **Crear repo en GitHub** (si no está hecho)
2. **Importar proyecto en Vercel**: vercel.com → Add New Project → Import from GitHub
3. **Configurar variables de entorno** en Vercel:
   ```
   VITE_SUPABASE_URL = https://XXXXXXXX.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJhbGci...
   ```
4. **Framework preset**: Vite (Vercel lo detecta automáticamente)
5. **Build command**: `npm run build`
6. **Output directory**: `dist`

### Configuración de Supabase para Vercel
En Supabase → Authentication → Settings:
- Site URL: `https://tibetan-editor.vercel.app` (o dominio custom)
- Additional redirect URLs: `https://*.vercel.app/**`

### Entornos recomendados
- **Preview**: por cada PR, Vercel genera un URL único → ideal para testing
- **Production**: main branch → tibetan-editor.vercel.app
- **Staging** (opcional): rama `staging` → tibetan-editor-staging.vercel.app con otro proyecto Supabase

---

## Backup y assets

### Backup de proyectos
- Autosave a localStorage: cada 30s → protege contra cierre accidental del tab
- Exportar JSON: acción manual, descarga completa del proyecto
- Cloud save: upsert en Supabase → persiste hasta que el usuario borre el registro
- **Recomendación**: no hay backup automático diario. Para producción, activar Point-in-Time Recovery en Supabase (plan Pro).

### Fuentes custom
- **Locales**: binarios en IndexedDB → se pierden si el usuario limpia el navegador
- **Cloud**: opt-in en FontManagerPanel → sube a Supabase Storage bajo `{userId}/{fontId}.{ext}`
- **Advertencia de licencia**: mostrar siempre antes del upload a la nube
- **Exportación PDF**: las fuentes se embeben en el PDF si están disponibles como ArrayBuffer

### Imágenes de portada
- Almacenamiento: bucket `images` en Supabase Storage (privado)
- Tamaño máximo recomendado: 2MB por imagen (comprimir antes de subir)
- Formato: JPEG o WebP para mejor compresión

---

## Features que pueden esperar post-deploy

| Feature | Por qué puede esperar |
|---------|----------------------|
| Undo/redo | Autosave mitiga el riesgo de pérdida |
| PDF multi-página | DOCX funciona, PDF válido para docs cortos |
| Colaboración realtime | Last-write-wins es suficiente para 1-2 editores |
| TOC automático | Manualmente editable como workaround |
| Drag & drop de filas | Botones ↑↓ funcionan |
| Presets de estilo | Edición manual por fila es funcional |

---

## Features que son bloqueantes para usuarios reales

| Feature | Estado |
|---------|--------|
| Guardar/cargar proyecto JSON | ✅ Implementado |
| Exportar PDF | ✅ Implementado (single-page) |
| Cloud save + auth | ✅ Implementado |
| Multi-proyecto | ✅ Implementado en esta fase |
| Comentarios | ✅ Implementado en esta fase |
| Portada / página final | ✅ Implementado en esta fase |
| Tab y Enter corregidos | ✅ Corregido en esta fase |
