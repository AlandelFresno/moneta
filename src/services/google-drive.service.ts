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

  // IMPORTANTE: El usuario debe configurar estas credenciales
  // Ir a: https://console.cloud.google.com/apis/credentials
  private CLIENT_ID = '';  // Configurar con tu Client ID
  private API_KEY = '';    // Configurar con tu API Key

  private isSignedInSubject = new BehaviorSubject<boolean>(false);
  public isSignedIn$ = this.isSignedInSubject.asObservable();

  private gapiInitialized = false;
  private tokenClient: any;
  private accessToken: string | null = null;

  constructor() {
    this.loadGoogleDriveConfig();
  }

  /**
   * Cargar configuración de Google Drive desde localStorage
   */
  private loadGoogleDriveConfig(): void {
    const config = localStorage.getItem('google_drive_config');
    if (config) {
      try {
        const { clientId, apiKey } = JSON.parse(config);
        this.CLIENT_ID = clientId || '';
        this.API_KEY = apiKey || '';
      } catch (error) {
        console.error('Error loading Google Drive config:', error);
      }
    }
  }

  /**
   * Guardar configuración de Google Drive
   */
  saveGoogleDriveConfig(clientId: string, apiKey: string): void {
    this.CLIENT_ID = clientId;
    this.API_KEY = apiKey;
    localStorage.setItem('google_drive_config', JSON.stringify({ clientId, apiKey }));
  }

  /**
   * Verificar si las credenciales están configuradas
   */
  hasCredentials(): boolean {
    const hasCredentials = !!this.CLIENT_ID && !!this.API_KEY;
    console.log('🔍 [GoogleDriveService] Verificando credenciales:', {
      hasClientId: !!this.CLIENT_ID,
      hasApiKey: !!this.API_KEY,
      hasCredentials
    });
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
            this.isSignedInSubject.next(false);
            return;
          }

          console.log('✅ [GoogleDriveService] Token obtenido exitosamente');
          this.accessToken = response.access_token;
          this.isSignedInSubject.next(true);
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
   */
  async signIn(): Promise<void> {
    if (!this.gapiInitialized) {
      await this.initClient();
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

          this.accessToken = response.access_token;
          this.isSignedInSubject.next(true);
          resolve();
        };

        // Solicitar token
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Cerrar sesión
   */
  async signOut(): Promise<void> {
    if (this.accessToken) {
      google.accounts.oauth2.revoke(this.accessToken, () => {
        console.log('✅ [GoogleDriveService] Sesión cerrada');
      });
      this.accessToken = null;
      this.isSignedInSubject.next(false);
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
    if (!this.gapiInitialized) {
      await this.initClient();
    }

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
   * Crear o obtener carpeta "Budget Tracker" en Drive
   */
  async getOrCreateBudgetFolder(): Promise<string> {
    try {
      // Buscar si ya existe la carpeta
      const response = await gapi.client.drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and name='Budget Tracker' and trashed=false",
        fields: 'files(id, name)',
        spaces: 'drive'
      });

      if (response.result.files && response.result.files.length > 0) {
        return response.result.files[0].id;
      }

      // Crear la carpeta si no existe
      const folderMetadata = {
        name: 'Budget Tracker',
        mimeType: 'application/vnd.google-apps.folder'
      };

      const folder = await gapi.client.drive.files.create({
        resource: folderMetadata,
        fields: 'id'
      });

      console.log('✅ Created Budget Tracker folder:', folder.result.id);
      return folder.result.id;
    } catch (error) {
      console.error('❌ Error creating/getting folder:', error);
      throw error;
    }
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
