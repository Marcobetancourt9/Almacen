# 🏭 Almacén Pincho Pan · Control de inventario

<img src="public/pinchopan.png" alt="Pincho Pan" height="48">

Sistema de almacén de **Inversiones Pincho Pan Express II C.A.**.

Sistema de almacén en tiempo real hecho con **React 19 + TypeScript + Tailwind CSS 4 + Firebase**.
Varios usuarios pueden registrar productos, anotar cuánto se usa de cada uno y ver quién hizo cada movimiento, desde cualquier lugar.

## Pestañas

| Pestaña | Qué hace | Quién la ve |
|---|---|---|
| **Inicio** | Indicadores, gráfico de 14 días, alertas de stock, productos más usados y actividad reciente | Todos |
| **Inventario** | Tabla con búsqueda, filtros, orden, alertas y exportación a **Excel**. Ficha de cada producto con su historial | Todos |
| **Registrar producto** | Alta de productos (SKU único, categoría, unidad, ubicación, stock mínimo, cantidad inicial) | Admin, Operador |
| **Uso y entradas** | Registrar **uso/salida**, **entrada** o **ajuste** de conteo, con motivo y nota | Admin, Operador |
| **Historial** | Registro inmutable: quién, qué, cuánto, cuándo y por qué. Filtros por usuario, tipo y fechas. Exportación a **Excel** | Todos |
| **Usuarios** | Cambiar roles y activar/desactivar cuentas | Admin |
| **Perfil** | Nombre visible, tema claro/oscuro, actividad propia | Todos |

## Conectar tu proyecto de Firebase

Todos los datos (usuarios, productos y movimientos) y el inicio de sesión se manejan **siempre en Firebase**. El proyecto ya está conectado a **`almacen-1c4af`** ([`src/firebase.config.ts`](src/firebase.config.ts) y [`.firebaserc`](.firebaserc)).

1. ✅ Proyecto creado y credenciales colocadas.
2. **Authentication → Método de acceso →** habilita *Correo electrónico/contraseña* y **Google** (elige un correo de asistencia). Si publicas la app en otro dominio (Vercel, Hosting…), añádelo en *Authentication → Configuración → Dominios autorizados*.
3. **Firestore Database → Crear base de datos** (modo producción, elige la región más cercana).
4. ✅ App web registrada.
5. ✅ `firebaseConfig` en `src/firebase.config.ts` *(alternativa: `.env.local`, ver `.env.example`; las variables de entorno tienen prioridad)*.
6. Publica las reglas de seguridad e índices:

   ```bash
   npx firebase login
   npm run deploy:rules
   ```

7. `npm run dev`, abre la app y **regístrate (con correo o con Google): el primer usuario se convierte automáticamente en Administrador**. Los siguientes entran como *Solo lectura* hasta que un admin les asigne rol en la pestaña **Usuarios**.

Para publicar la web en Firebase Hosting: `npm run deploy`.

> Las claves de `firebaseConfig` no son secretas (siempre viajan al navegador). Lo que protege la base de datos son las reglas de [`firestore.rules`](firestore.rules), por eso el paso 6 es obligatorio.

### Probar sin tocar tu proyecto real (emuladores)

```bash
npm run dev:emulator
```

Arranca los emuladores de Auth y Firestore (requiere Java) y la app conectada a ellos, con las mismas reglas de seguridad. Panel de los emuladores: <http://127.0.0.1:4000>.

## Exportación a Excel

Los botones **Exportar Excel** (Inventario, Historial y ficha de cada producto) consultan **en ese momento** a Firebase —nunca a la caché— y descargan un `.xlsx` con:

- cabecera con estilo, filtros automáticos y primera fila fija,
- fechas y números con formato real de Excel (se pueden sumar y ordenar),
- colores de estado (agotado, stock bajo, entradas/usos),
- hoja extra: *Alertas de stock* (inventario) o *Resumen por producto* con totales ingresados y usados (movimientos).

Se aplican los mismos filtros que tengas en pantalla. En el historial, el Excel incluye **todos** los movimientos que coinciden, no solo los 500 visibles.

## Backend resistente

- **Transacciones atómicas**: cada uso/entrada actualiza el stock y crea el movimiento en una sola transacción. Si dos personas usan el mismo producto a la vez, Firestore reintenta con el valor real; nunca se pierden ni duplican cantidades y el stock no puede quedar negativo.
- **Reglas de seguridad estrictas** (`firestore.rules`): el servidor valida roles, cuentas desactivadas, esquema y tamaño de cada campo, que el usuario del movimiento sea quien lo hace y que `stock anterior + variación = stock nuevo`. El stock **solo** puede cambiar acompañado de un movimiento coherente.
- **Historial inmutable**: los movimientos no se pueden editar ni borrar; los productos se archivan en lugar de eliminarse.
- **SKU como ID**: imposible duplicar productos.
- **Caché offline**: se sigue viendo el inventario sin conexión y se resincroniza al volver.
- **Validación doble**: Zod en el cliente + reglas en el servidor.

## Reporte diario por correo (6:00 pm)

Todos los días a las **6:00 pm (hora de Venezuela)** el workflow [`.github/workflows/daily-report.yml`](.github/workflows/daily-report.yml) lee Firestore y envía a **todos los administradores activos** un correo con:

- indicadores del día (movimientos, entradas, usos, productos nuevos),
- actividad por usuario (quién hizo qué),
- productos movidos con lo ingresado, lo usado y el stock actual,
- el detalle de cada movimiento (hora, usuario, tipo, cantidad, stock antes → después, motivo y nota),
- productos registrados ese día y alertas de stock,
- un **Excel adjunto** con todo el detalle.

Los destinatarios se toman de la colección `users` (rol *Administrador* y cuenta activa): al ascender o desactivar a alguien en la pestaña **Usuarios**, cambia automáticamente quién recibe el correo. Se envía con copia oculta (cada admin no ve a los demás).

**Configuración (una vez)** en GitHub → *Settings → Secrets and variables → Actions*:

| Tipo | Nombre | Valor |
|---|---|---|
| Secreto | `FIREBASE_SERVICE_ACCOUNT` | JSON de la cuenta de servicio (el mismo de los backups) |
| Secreto | `SMTP_HOST` | `smtp.gmail.com` (o el de tu proveedor) |
| Secreto | `SMTP_PORT` | `465` |
| Secreto | `SMTP_USER` | el correo que envía, p. ej. `almacen.notificaciones@gmail.com` |
| Secreto | `SMTP_PASS` | **contraseña de aplicación** (no la contraseña normal) |
| Secreto (opcional) | `MAIL_FROM` | remitente, si es distinto de `SMTP_USER` |
| Variable (opcional) | `REPORT_EXTRA_TO` | correos extra separados por coma |
| Variable (opcional) | `REPORT_SKIP_EMPTY` | `true` para no enviar nada los días sin movimientos |
| Variable (opcional) | `APP_URL` | enlace a la app (aparece un botón en el correo) |

*Contraseña de aplicación de Gmail:* activa la verificación en 2 pasos en la cuenta y crea una en <https://myaccount.google.com/apppasswords>. Recomendado usar una cuenta de Gmail dedicada solo a enviar notificaciones.

**Probar:** *Actions → Reporte diario por correo → Run workflow* (puedes indicar una fecha para reenviar un día pasado). Para ver el correo sin enviarlo, en local:

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run report:preview   # genera report-output/*.html y *.xlsx
```

> GitHub puede retrasar unos minutos las tareas programadas en horas de mucha carga. Si cambias de zona horaria, ajusta el `cron` y `REPORT_TZ` en el workflow.

## Backups con GitHub Actions

El workflow `.github/workflows/backup.yml` exporta todas las colecciones a JSON **cada día a las 06:00 UTC** (y cuando quieras desde *Actions → Backup Firestore → Run workflow*). Cada backup:

- se sube como **artefacto** (se guarda 90 días),
- y se guarda en la rama **`backups`** del repositorio (últimos 60; desactívalo con la variable de repositorio `BACKUP_TO_BRANCH=false`).
- incluye `manifest.json` con conteos y checksums SHA-256.

> ⚠️ Si el repositorio es **público**, los backups en la rama también lo serán. Usa un repositorio privado o desactiva `BACKUP_TO_BRANCH`.

**Configuración (una vez):**

1. Firebase → *Configuración del proyecto → Cuentas de servicio →* **Generar nueva clave privada** (descarga un `.json`).
2. GitHub → *Settings → Secrets and variables → Actions → New repository secret*:
   - Nombre: `FIREBASE_SERVICE_ACCOUNT`
   - Valor: el contenido completo del `.json`.
3. Nunca subas ese `.json` al repositorio (ya está en `.gitignore`).

**Restaurar un backup:**

```bash
# Simulación (no escribe nada)
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/restore.mjs backups/2026-11-20_0600
# Restaurar de verdad
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/restore.mjs backups/2026-11-20_0600 --yes
```

**Cambiar el rol de alguien desde la terminal** (por si nadie es admin):

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json npm run set-role -- correo@empresa.com admin
```

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo en http://localhost:5180 (con tu proyecto de Firebase) |
| `npm run dev:emulator` | App + emuladores locales de Firebase |
| `npm run build` | Compilación de producción (verifica tipos) |
| `npm run lint` | Linter |
| `npm run backup` | Backup local (requiere credenciales) |
| `npm run report:preview` | Genera el reporte diario sin enviarlo |
| `npm run report` | Envía el reporte diario ahora |
| `npm run test:rules` | Prueba las reglas de seguridad en el emulador (26 casos, requiere Java) |
| `npm run deploy:rules` | Publica reglas e índices de Firestore |
| `npm run deploy` | Compila y publica todo en Firebase |

## Estructura

```
src/
  services/       backend.ts (contrato) · firebaseBackend.ts · stock.ts (lógica de stock)
  context/        AuthContext (sesión y rol) · DataContext (datos en tiempo real compartidos)
  pages/          una pantalla por pestaña
  components/     layout, formularios y UI reutilizable
  lib/            validación (Zod), Excel, formato, errores, Firebase
src/firebase.config.ts   ← aquí van tus credenciales
firestore.rules   reglas de seguridad del servidor
scripts/          backup, restore, set-role y daily-report (firebase-admin)
.github/workflows CI, backup diario y reporte diario por correo
```
