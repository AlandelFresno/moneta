# Configuración de Google Drive para Budget Tracker

Esta guía explica cómo configurar la integración con Google Drive para guardar automáticamente tus backups de Excel.

## Paso 1: Crear un Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Haz clic en "Crear Proyecto" y dale un nombre (ej: "Budget Tracker")

## Paso 2: Habilitar la API de Google Drive

1. En el menú lateral, ve a **APIs y servicios** > **Biblioteca**
2. Busca "Google Drive API"
3. Haz clic en "Google Drive API"
4. Presiona el botón **"HABILITAR"**

## Paso 3: Crear Credenciales (API Key)

1. Ve a **APIs y servicios** > **Credenciales**
2. Haz clic en **"+ CREAR CREDENCIALES"** > **"Clave de API"**
3. Copia la **API Key** que se genera
4. Haz clic en "Restringir clave" (recomendado)
5. En "Restricciones de API":
   - Selecciona "Restringir la clave"
   - Marca solo **"Google Drive API"**
6. Guarda los cambios

## Paso 4: Crear OAuth 2.0 Client ID

1. Ve a **APIs y servicios** > **Credenciales**
2. Haz clic en **"+ CREAR CREDENCIALES"** > **"ID de cliente de OAuth"**
3. Si es la primera vez, te pedirá configurar la **"Pantalla de consentimiento OAuth"**:
   - Tipo de usuario: **"Externa"** (para uso personal)
   - Haz clic en **"Crear"**
   - Completa los campos obligatorios:
     - Nombre de la aplicación: "Budget Tracker"
     - Correo electrónico de asistencia: tu email
     - Correo electrónico del desarrollador: tu email
   - Guarda y continúa
   - En "Ámbitos" (Scopes), haz clic en "AGREGAR O QUITAR ÁMBITOS"
   - Busca y agrega: `https://www.googleapis.com/auth/drive.file`
   - Guarda y continúa
   - En "Usuarios de prueba", agrega tu email de Google
   - Completa y vuelve al panel

4. Ahora crea el Client ID:
   - Tipo de aplicación: **"Aplicación web"**
   - Nombre: "Budget Tracker Web"
   - En "Orígenes de JavaScript autorizados", agrega:
     - `http://localhost:4200` (para desarrollo)
     - Tu dominio de producción si tienes uno (ej: `https://tudominio.com`)
   - En "URIs de redireccionamiento autorizados", agrega:
     - `http://localhost:4200` (para desarrollo)
     - Tu dominio de producción si tienes uno
   - Haz clic en **"CREAR"**

5. Copia el **Client ID** que se genera (formato: `xxxxx.apps.googleusercontent.com`)

## Paso 5: Configurar en la Aplicación

1. Abre la aplicación Budget Tracker
2. Ve a **Settings** (Configuración)
3. Busca la sección **"Integración con Google Drive"**
4. Pega tu **Client ID** en el campo correspondiente
5. Pega tu **API Key** en el campo correspondiente
6. Haz clic en **"Guardar Configuración"**

## Paso 6: Autorizar la Aplicación

1. En el sidebar, haz clic en **"Guardar en Drive"**
2. Se abrirá una ventana de Google pidiéndote que autorices la aplicación
3. Selecciona tu cuenta de Google
4. Acepta los permisos solicitados
5. Listo! Ahora tus backups se guardarán automáticamente en Google Drive

## Ubicación de los Archivos

Los archivos exportados se guardarán en:
- **Google Drive** > **Budget Tracker** > `budget_tracker_completo_FECHA.xlsx`

## Seguridad

- La aplicación **solo tiene acceso a los archivos que ella misma crea**
- **NO** tiene acceso a tus otros archivos de Drive
- Puedes revocar el acceso en cualquier momento desde tu cuenta de Google: [Seguridad de la cuenta](https://myaccount.google.com/permissions)

## Solución de Problemas

### Error: "API key not valid"
- Verifica que la API Key esté correctamente copiada
- Asegúrate de que la API Key tenga permisos para Google Drive API

### Error: "Client ID not valid"
- Verifica que el Client ID esté correctamente copiado
- Asegúrate de haber agregado el origen correcto en Google Cloud Console

### Error: "Access denied"
- Verifica que hayas agregado tu email en "Usuarios de prueba"
- Asegúrate de haber publicado la app o agregarla como "En producción"

### La ventana de autorización no se abre
- Verifica que no estés bloqueando popups en tu navegador
- Intenta en modo incógnito para descartar problemas de caché

## Notas Importantes

- **Modo de prueba**: Si tu app está en modo de prueba, solo los usuarios agregados en "Usuarios de prueba" podrán usarla
- **Publicación**: Para uso público, necesitarás pasar el proceso de verificación de Google (no necesario para uso personal)
- **Cuota de API**: Google Drive API tiene límites de uso. Para uso personal, estos límites son más que suficientes.
