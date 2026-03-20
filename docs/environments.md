# Tibetan Editor — Entornos y Configuración

---

## Variables de entorno

### Obligatorias

| Variable | Descripción | Ejemplo |
|---|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | `https://abcxyz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Clave pública (anon/publishable) del proyecto | `sb_publishable_XXXX` |

### Cómo obtenerlas
1. Ir a [supabase.com](https://supabase.com) → tu proyecto
2. **Settings → API**
3. Copiar:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Project API Keys → anon / public** → `VITE_SUPABASE_ANON_KEY`

> ⚠️ Nunca usar la `service_role` key en el cliente. Tiene acceso total sin RLS.

---

## Archivos por entorno

### `.env.local` (desarrollo — NO commitear)
```
VITE_SUPABASE_URL=https://tu-proyecto-dev.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxx_dev
```
- Excluido por `.gitignore` (`*.local`)
- Usar el **proyecto de desarrollo** de Supabase (separado del de producción)

### `.env.example` (commitear — valores de ejemplo, sin secretos)
```
VITE_SUPABASE_URL=https://TU_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

### Vercel (producción)
- Configurar en: **Vercel Dashboard → tu proyecto → Settings → Environment Variables**
- Agregar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para el entorno `Production`
- Si usás staging: agregar las mismas variables con valores del proyecto de staging para el entorno `Preview`

---

## Estrategia de entornos

### Desarrollo (`localhost`)

- Supabase: crear un proyecto separado en Supabase (gratis) llamado `tibetan-editor-dev`
- Schema: ejecutar `schema.sql` + `schema-v2.sql` + `schema-v3-security.sql`
- Variables en `.env.local`
- Auth: el usuario puede registrarse libremente
- URL de callback auth: `http://localhost:5173`

### Staging (`tibetan-editor-staging.vercel.app`)

- Supabase: mismo proyecto de dev puede servir de staging, o crear uno separado
- Variables en Vercel para el entorno `Preview`
- Útil para testear antes de producción con datos reales
- Auth: configurar en Supabase → **Authentication → URL Configuration → Redirect URLs** → agregar `https://tibetan-editor-staging.vercel.app/**`

### Producción (`tibetan-editor.vercel.app` o dominio propio)

- Supabase: proyecto de producción **separado** del de desarrollo
- Variables en Vercel para el entorno `Production`
- Auth: configurar en Supabase → **Authentication → URL Configuration**:
  - **Site URL**: `https://tu-dominio.com`
  - **Redirect URLs**: `https://tu-dominio.com/**`
- RLS: verificar que todas las políticas estén aplicadas
- Backups: habilitar PITR (Point-in-Time Recovery) en el plan Pro

---

## Configuración de Supabase Auth por entorno

### Ajustes recomendados (Supabase Dashboard → Authentication → Settings)

| Ajuste | Dev | Staging | Producción |
|---|---|---|---|
| Confirm email | OFF (más cómodo para dev) | ON | ON |
| Magic link habilitado | Sí | Sí | Sí |
| Site URL | `http://localhost:5173` | `https://staging.url` | `https://tu-dominio.com` |
| Redirect URLs | `http://localhost:5173/**` | `https://staging.url/**` | `https://tu-dominio.com/**` |
| SMTP personalizado | No (usa el de Supabase) | Recomendable | Sí (SendGrid, Resend, etc.) |

---

## Backups

### Base de datos

- **Supabase Free tier**: backup diario automático (últimas 24hs)
- **Supabase Pro**: PITR (Point-in-Time Recovery) — recomendado para producción real
- **Manual**: descargar dump desde Supabase Dashboard → Database → Backups
- **Script de backup local**: exportar proyectos como JSON desde la app (funcionalidad existente)

### Storage (fuentes e imágenes)

- No hay backup automático en el tier gratuito
- Estrategia recomendada: los usuarios mantienen sus fuentes localmente
- Exportación de proyectos como ZIP (a implementar en el futuro) incluiría las fuentes

### Datos de usuarios

- Los proyectos se pueden exportar como JSON desde la app (funcionalidad ya implementada)
- Recomendar a usuarios exportar sus proyectos periódicamente
- A futuro: script de exportación masiva vía Supabase Admin API

---

## Checklist de deploy en Vercel

### Paso a paso

1. Subir código a GitHub (ver sección abajo)
2. Ir a [vercel.com](https://vercel.com) → Import Project → seleccionar el repo
3. Framework: Vite (detectado automáticamente)
4. Environment Variables: agregar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
5. Deploy

### Comandos de build (ya configurados en `package.json`)
```bash
npm run build   # crea dist/ con los archivos estáticos
npm run preview # previsualiza el build localmente
```

### Después del primer deploy

1. Copiar la URL de producción (ej. `https://tibetan-editor.vercel.app`)
2. Ir a Supabase → Authentication → URL Configuration
3. Actualizar **Site URL** a la URL de producción
4. Agregar la URL a **Redirect URLs**: `https://tibetan-editor.vercel.app/**`
5. Ejecutar `schema-v3-security.sql` en el proyecto de producción si no fue hecho

---

## Git: inicializar y conectar a GitHub

Si el proyecto no tiene git inicializado:

```bash
cd /home/gabi/Documents/Transcripcion/tibetan-editor

# Inicializar git
git init
git add .
git commit -m "Initial commit"

# Conectar a GitHub (usando HTTPS + PAT)
git remote add origin https://github.com/GabiArrieta/tibetan-editor.git
git branch -M main
git push -u origin main
```

### Autenticación con GitHub (HTTPS)

GitHub ya no acepta contraseñas. Necesitás un **Personal Access Token (PAT)**:

1. Ir a: github.com → Settings → Developer Settings → Personal Access Tokens → Fine-grained tokens
2. Crear un token con:
   - **Repository access**: `tibetan-editor` (solo ese repo)
   - **Permissions**: Contents → Read and Write
3. Cuando Git pida contraseña, pegar el token
4. Para guardarlo: `git config --global credential.helper store`

---

## Seguridad: qué no commitear nunca

- `.env.local` — ya en `.gitignore`
- Archivos de fuentes (`.ttf`, `.otf`, `.woff*`) — son propiedad del usuario
- Cualquier archivo con keys reales
- Carpeta `node_modules/`
