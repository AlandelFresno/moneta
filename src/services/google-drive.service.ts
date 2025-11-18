import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

declare var gapi: any;
declare var google: any;

@Injectable({
  providedIn: 'root'
})
export class GoogleDriveService {
  private readonly DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
  private readonly SCOPES = 'https://www.googleapis.com/auth/drive.file';

  // Credenciales de Google OAuth
  // IMPORTANTE: Estas credenciales están restringidas por dominio en Google Cloud Console
  // Solo funcionarán desde los dominios autorizados (localhost:4200, tu-dominio.com, etc.)
  private CLIENT_ID = '615072104513-iev6ja33i73h7goeoqdadur7aefjn8cc.apps.googleusercontent.com';
  private API_KEY = 'AIzaSyDHEO5Vv-_pZxs5DGpO0kCieIe3XMHA5Bk';

  private isSignedInSubject = new BehaviorSubject<boolean>(false);
  public isSignedIn$ = this.isSignedInSubject.asObservable();

  private gapiInitialized = false;
  private tokenClient: any;
  private accessToken: string | null = null;
  private readonly TOKEN_STORAGE_KEY = 'google_drive_access_token';

  constructor() {
    // Cargar token guardado si existe
    this.loadStoredToken();
  }

  /**
   * Cargar token almacenado
   */
  private loadStoredToken(): void {
    const storedToken = localStorage.getItem(this.TOKEN_STORAGE_KEY);
    if (storedToken) {
      this.accessToken = storedToken;
      this.isSignedInSubject.next(true);
      console.log('✅ [GoogleDriveService] Token cargado desde localStorage');
    }
  }

  /**
   * Guardar token en localStorage
   */
  private saveToken(token: string): void {
    this.accessToken = token;
    localStorage.setItem(this.TOKEN_STORAGE_KEY, token);
    this.isSignedInSubject.next(true);
  }

  /**
   * Eliminar token guardado
   */
  private clearToken(): void {
    this.accessToken = null;
    localStorage.removeItem(this.TOKEN_STORAGE_KEY);
    this.isSignedInSubject.next(false);
  }

  /**
   * Verificar si las credenciales están configuradas
   */
  hasCredentials(): boolean {
    const hasCredentials = !!this.CLIENT_ID && !!this.API_KEY;
    if (!hasCredentials) {
      console.warn('⚠️ [GoogleDriveService] Credenciales no configuradas. Agrega tu Client ID y API Key en google-drive.service.ts');
    }
    return hasCredentials;
  }

  /**
   * Inicializar Google API
   */
  async initClient(): Promise<void> {
    if (this.gapiInitialized) {
      return;
    }

    if (!this.hasCredentials()) {
      throw new Error('Credenciales de Google Drive no configuradas. Por favor ve a Settings y configura el Client ID y API Key.');
    }

    return new Promise((resolve, reject) => {
      // Cargar scripts de Google
      this.loadGoogleScripts()
        .then(() => {
          gapi.load('client', async () => {
            try {
              await this.initializeGapiClient();
              this.initializeGISClient();
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        })
        .catch(reject);
    });
  }

  private async loadGoogleScripts(): Promise<void> {
    // Cargar GAPI (para Drive API)
    if (typeof gapi === 'undefined') {
      await this.loadScript('https://apis.google.com/js/api.js');
    }

    // Cargar GIS (para autenticación)
    if (typeof google === 'undefined' || !google.accounts) {
      await this.loadScript('https://accounts.google.com/gsi/client');
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.body.appendChild(script);
    });
  }

  private async initializeGapiClient(): Promise<void> {
    try {
      console.log('🔧 [GoogleDriveService] Inicializando cliente GAPI...');
      await gapi.client.init({
        apiKey: this.API_KEY,
        discoveryDocs: this.DISCOVERY_DOCS
      });

      this.gapiInitialized = true;
      console.log('✅ [GoogleDriveService] Cliente GAPI inicializado correctamente');
    } catch (error: any) {
      console.error('❌ [GoogleDriveService] Error al inicializar GAPI:', error);

      let errorMessage = 'Error al inicializar Google Drive API';

      if (error.details) {
        errorMessage += `: ${error.details}`;
      } else if (error.error) {
        errorMessage += `: ${error.error}`;
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      }

      throw new Error(errorMessage);
    }
  }

  private initializeGISClient(): void {
    try {
      console.log('🔧 [GoogleDriveService] Inicializando cliente GIS...');

      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.CLIENT_ID,
        scope: this.SCOPES,
        callback: (response: any) => {
          if (response.error) {
            console.error('❌ [GoogleDriveService] Error en autenticación:', response);
            this.clearToken();
            return;
          }

          console.log('✅ [GoogleDriveService] Token obtenido exitosamente');
          this.saveToken(response.access_token);
        },
      });

      console.log('✅ [GoogleDriveService] Cliente GIS inicializado correctamente');
    } catch (error: any) {
      console.error('❌ [GoogleDriveService] Error al inicializar GIS:', error);

      let errorMessage = 'Error al inicializar autenticación de Google';

      if (error.message) {
        errorMessage += `: ${error.message}`;
      }

      if (error.message?.includes('origin')) {
        errorMessage += '. Verifica que http://localhost:4200 esté autorizado en Google Cloud Console.';
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Iniciar sesión con Google
   * @param forceConsent Si es true, fuerza a mostrar el selector de cuenta
   */
  async signIn(forceConsent: boolean = false): Promise<void> {
    // SIEMPRE inicializar gapi primero
    if (!this.gapiInitialized) {
      await this.initClient();
    }

    // Si ya hay token y no se fuerza consent, validar que esté disponible
    if (this.accessToken && !forceConsent) {
      console.log('✅ [GoogleDriveService] Usando token existente');
      // Validar que gapi esté listo
      if (typeof gapi === 'undefined') {
        console.warn('⚠️ [GoogleDriveService] gapi no está definido, reinicializando...');
        this.gapiInitialized = false;
        await this.initClient();
      }
      return Promise.resolve();
    }

    console.log('🔐 [GoogleDriveService] Solicitando autenticación...');

    // Solicitar token con GIS
    return new Promise((resolve, reject) => {
      try {
        // Configurar callback temporal
        const originalCallback = this.tokenClient.callback;
        this.tokenClient.callback = (response: any) => {
          // Restaurar callback original
          this.tokenClient.callback = originalCallback;

          if (response.error) {
            reject(new Error(response.error));
            return;
          }

          this.saveToken(response.access_token);
          resolve();
        };

        // Solicitar token - usar prompt vacío para no pedir cuenta cada vez
        // Solo usar 'consent' si se fuerza explícitamente
        this.tokenClient.requestAccessToken({
          prompt: forceConsent ? 'consent' : ''
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Asegurar que gapi esté inicializado antes de usarlo
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.gapiInitialized || typeof gapi === 'undefined') {
      console.log('🔄 [GoogleDriveService] Inicializando gapi...');
      this.gapiInitialized = false;
      await this.initClient();
    }
  }

  /**
   * Cerrar sesión
   */
  async signOut(): Promise<void> {
    if (this.accessToken) {
      google.accounts.oauth2.revoke(this.accessToken, () => {
        console.log('✅ [GoogleDriveService] Sesión cerrada');
      });
      this.clearToken();
    }
  }

  /**
   * Verificar si el usuario está autenticado
   */
  isSignedIn(): boolean {
    return this.isSignedInSubject.value && !!this.accessToken;
  }

  /**
   * Subir archivo a Google Drive
   */
  async uploadFile(
    fileName: string,
    fileContent: Blob,
    mimeType: string,
    folderId?: string
  ): Promise<any> {
    await this.ensureInitialized();

    if (!this.isSignedIn()) {
      throw new Error('Usuario no autenticado. Por favor inicia sesión en Google Drive primero.');
    }

    const metadata = {
      name: fileName,
      mimeType: mimeType,
      ...(folderId && { parents: [folderId] })
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileContent);

    try {
      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          },
          body: form
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fallo al subir archivo: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ [GoogleDriveService] Archivo subido a Google Drive:', result);
      return result;
    } catch (error) {
      console.error('❌ [GoogleDriveService] Error al subir archivo a Google Drive:', error);
      throw error;
    }
  }

  /**
   * Buscar archivo por nombre en el root de Drive
   */
  async findFileByName(fileName: string): Promise<string | null> {
    await this.ensureInitialized();

    try {
      console.log(`🔍 [GoogleDriveService] Buscando archivo: ${fileName}`);

      const response = await gapi.client.drive.files.list({
        q: `name='${fileName}' and trashed=false and 'root' in parents`,
        fields: 'files(id, name, webViewLink)',
        spaces: 'drive'
      });

      if (response.result.files && response.result.files.length > 0) {
        const fileId = response.result.files[0].id;

        // Validar que el fileId sea válido
        if (!fileId || fileId.trim() === '' || fileId === '.' || fileId === 'null' || fileId === 'undefined') {
          console.error('❌ [GoogleDriveService] Google Drive retornó un fileId inválido:', fileId);
          return null;
        }

        console.log(`✅ [GoogleDriveService] Archivo encontrado: ${fileName} (ID: ${fileId})`);
        return fileId;
      }

      console.log(`ℹ️ [GoogleDriveService] Archivo no encontrado: ${fileName}`);
      return null;
    } catch (error) {
      console.error('❌ [GoogleDriveService] Error buscando archivo:', error);
      throw error;
    }
  }

  /**
   * Actualizar archivo existente en Drive
   */
  async updateFile(
    fileId: string,
    fileContent: Blob,
    mimeType: string
  ): Promise<any> {
    await this.ensureInitialized();

    if (!this.isSignedIn()) {
      throw new Error('Usuario no autenticado. Por favor inicia sesión en Google Drive primero.');
    }

    // Validar fileId
    if (!fileId || fileId.trim() === '' || fileId === '.' || fileId === 'null' || fileId === 'undefined') {
      console.error('❌ [GoogleDriveService] fileId inválido:', fileId);
      throw new Error(`fileId inválido: "${fileId}". No se puede actualizar el archivo.`);
    }

    try {
      console.log(`🔄 [GoogleDriveService] Actualizando archivo con ID: ${fileId}`);

      const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': mimeType
          },
          body: fileContent
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [GoogleDriveService] Error en PATCH:', errorText);
        throw new Error(`Fallo al actualizar archivo: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ [GoogleDriveService] Archivo actualizado (PATCH exitoso)');

      // Obtener webViewLink del archivo actualizado
      try {
        const fileInfo = await gapi.client.drive.files.get({
          fileId: fileId,
          fields: 'id,name,webViewLink'
        });

        console.log('✅ [GoogleDriveService] Archivo actualizado en Google Drive:', fileInfo.result);
        return fileInfo.result;
      } catch (getError) {
        console.warn('⚠️ [GoogleDriveService] No se pudo obtener info del archivo, pero actualización fue exitosa');
        return result;
      }
    } catch (error) {
      console.error('❌ [GoogleDriveService] Error al actualizar archivo:', error);
      throw error;
    }
  }

  /**
   * Subir o actualizar archivo con nombre fijo en el root de Drive
   */
  async uploadOrUpdateFile(
    fileName: string,
    fileContent: Blob,
    mimeType: string
  ): Promise<any> {
    await this.ensureInitialized();

    if (!this.isSignedIn()) {
      throw new Error('Usuario no autenticado. Por favor inicia sesión en Google Drive primero.');
    }

    try {
      console.log(`📂 [GoogleDriveService] uploadOrUpdateFile iniciado para: ${fileName}`);

      // Buscar si ya existe el archivo
      const existingFileId = await this.findFileByName(fileName);

      console.log(`📋 [GoogleDriveService] Resultado de búsqueda - fileId:`, existingFileId);

      if (existingFileId) {
        // Actualizar archivo existente
        console.log(`🔄 [GoogleDriveService] Archivo existe, actualizando: ${fileName} (ID: ${existingFileId})`);
        return await this.updateFile(existingFileId, fileContent, mimeType);
      } else {
        // Crear archivo nuevo en root (sin folderId)
        console.log(`📝 [GoogleDriveService] Archivo no existe, creando nuevo: ${fileName}`);
        return await this.uploadFile(fileName, fileContent, mimeType);
      }
    } catch (error) {
      console.error('❌ [GoogleDriveService] Error en uploadOrUpdateFile:', error);
      throw error;
    }
  }

  /**
   * Buscar o crear una carpeta en Google Drive
   * @param folderName - Nombre de la carpeta a buscar/crear
   * @param parentId - ID de la carpeta padre (opcional, si no se especifica se crea en root)
   * @returns ID de la carpeta
   */
  async findOrCreateFolder(folderName: string, parentId?: string): Promise<string> {
    if (!this.gapiInitialized) {
      await this.initClient();
    }

    if (!this.isSignedIn()) {
      throw new Error('Usuario no autenticado. Por favor inicia sesión en Google Drive primero.');
    }

    try {
      // Construir query de búsqueda
      let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;

      if (parentId) {
        query += ` and '${parentId}' in parents`;
      } else {
        query += ` and 'root' in parents`;
      }

      // Buscar si ya existe la carpeta
      const response = await gapi.client.drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive'
      });

      if (response.result.files && response.result.files.length > 0) {
        console.log(`✅ [GoogleDriveService] Carpeta encontrada: ${folderName} (ID: ${response.result.files[0].id})`);
        return response.result.files[0].id;
      }

      // Crear la carpeta si no existe
      const folderMetadata: any = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      };

      if (parentId) {
        folderMetadata.parents = [parentId];
      }

      const folder = await gapi.client.drive.files.create({
        resource: folderMetadata,
        fields: 'id'
      });

      console.log(`✅ [GoogleDriveService] Carpeta creada: ${folderName} (ID: ${folder.result.id})`);
      return folder.result.id;
    } catch (error) {
      console.error(`❌ [GoogleDriveService] Error al buscar/crear carpeta ${folderName}:`, error);
      throw error;
    }
  }

  /**
   * Crear o obtener carpeta "Budget Tracker" en Drive
   * @deprecated Usar findOrCreateFolder('Budget Tracker') en su lugar
   */
  async getOrCreateBudgetFolder(): Promise<string> {
    return this.findOrCreateFolder('Budget Tracker');
  }

  /**
   * Listar archivos de la carpeta Budget Tracker
   */
  async listBudgetFiles(): Promise<any[]> {
    try {
      const folderId = await this.getOrCreateBudgetFolder();

      const response = await gapi.client.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, webViewLink, createdTime)',
        orderBy: 'createdTime desc',
        pageSize: 50
      });

      return response.result.files || [];
    } catch (error) {
      console.error('❌ Error listing files:', error);
      throw error;
    }
  }
}
