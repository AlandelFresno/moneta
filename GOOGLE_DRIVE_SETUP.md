# Google Drive sync — cómo funciona

Moneta puede sincronizar tus Transacciones, Categorías y Servicios entre dispositivos usando tu propio Google Drive. No hay backend: cada dispositivo habla directo con la API de Drive usando tu cuenta de Google.

## Qué se sincroniza

Un solo archivo, `moneta-sync.json`, dentro de una carpeta **"Moneta"** que la app crea en la raíz de tu Drive (no dentro de `appDataFolder`, así podés verlo/borrarlo vos mismo si querés). Contiene las tres listas completas (Transacciones, Categorías, Servicios), incluyendo tombstones de elementos borrados (para que un borrado en un dispositivo se propague a los demás en vez de resucitar el registro).

El scope de permisos es `drive.file`: la app **solo** puede ver/tocar los archivos que ella misma crea, nunca el resto de tu Drive.

## Cómo se resuelven los conflictos

Por `id` + `updatedAt`: el registro modificado más recientemente gana (empate → gana el local). Un borrado (`deletedAt`) se trata como una modificación más, así que si borrás algo en un dispositivo y lo sincronizás, el borrado se propaga a los demás en la próxima sincronización de cada uno. Tombstones de más de 30 días se purgan automáticamente para que el archivo no crezca sin límite.

Es un merge "todo o nada" por registro, no campo por campo: si editás el mismo Servicio en dos dispositivos sin sincronizar entre medio (por ejemplo, registrás un pago en uno y cambiás el monto en el otro), gana la versión con `updatedAt` más reciente completa — no se combinan los cambios de ambos.

## Cuándo sincroniza

- Manual: botón **"Sincronizar"** en la página *Sincronización* del sidebar.
- Automático: una vez al abrir la app, si ya estás conectado (silencioso, no bloquea el arranque).

No hay sincronización periódica ni en segundo plano.

## Credenciales

Las credenciales de OAuth (Client ID web, Client ID + secret "de escritorio" para el flujo nativo, API key) ya están configuradas — viven en variables de entorno (`GOOGLE_CLIENT_ID`, `GOOGLE_API_KEY`, `GOOGLE_MOBILE_CLIENT_ID`, `GOOGLE_MOBILE_CLIENT_SECRET`) que `scripts/generate-env.mjs` vuelca a `src/environments/environment.ts` en cada build (`prebuild`). No hay ningún campo en la UI para pegar credenciales — a diferencia de una versión anterior de esta app, no hace falta tocar Google Cloud Console para usar esta función tal como está.

Si en algún momento hay que rotar o recrear las credenciales: proyecto en Google Cloud Console con la API de Drive habilitada, pantalla de consentimiento OAuth con el scope `https://www.googleapis.com/auth/drive.file`, un Client ID tipo "Aplicación web" (para el flujo de navegador) y un Client ID tipo "Aplicación de escritorio" (para el flujo PKCE nativo en Android — su ID reversado ya está registrado como esquema de URL en `android/app/src/main/AndroidManifest.xml` para recibir el redirect).

## Autenticación por plataforma

- **Web**: Google Identity Services (`accounts.google.com/gsi/client`), flujo implícito — token de acceso de corta duración, se renueva solo (silenciosamente si la sesión de Google sigue activa).
- **Nativo (Android)**: Authorization Code + PKCE vía navegador del sistema (`@capacitor/browser`), capturando el redirect por deep link (`@capacitor/app`). Pide `access_type=offline` para obtener un refresh token, así no hace falta reabrir el navegador cada hora.

## Solución de problemas

- **"La sesión de Google expiró"**: la página de Sincronización va a mostrar un botón "Reconectar" — es esperable si revocaste el acceso desde tu cuenta de Google o pasó mucho tiempo sin usar la app.
- Podés revocar el acceso en cualquier momento desde [myaccount.google.com/permissions](https://myaccount.google.com/permissions).
