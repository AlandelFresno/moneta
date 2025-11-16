import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

declare var gapi: any;

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
  private authInstance: any;

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
      // Cargar el script de Google API
      if (typeof gapi === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
          gapi.load('client:auth2', async () => {
            try {
              await this.initializeGapiClient();
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        };
        script.onerror = () => reject(new Error('Failed to load Google API script'));
        document.body.appendChild(script);
      } else {
        gapi.load('client:auth2', async () => {
          try {
            await this.initializeGapiClient();
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      }
    });
  }

  private async initializeGapiClient(): Promise<void> {
    try {
      console.log('🔧 [GoogleDriveService] Inicializando cliente GAPI...');
      await gapi.client.init({
        apiKey: this.API_KEY,
        clientId: this.CLIENT_ID,
        discoveryDocs: this.DISCOVERY_DOCS,
        scope: this.SCOPES
      });

      this.authInstance = gapi.auth2.getAuthInstance();
      this.gapiInitialized = true;

      // Escuchar cambios en el estado de autenticación
      this.authInstance.isSignedIn.listen((isSignedIn: boolean) => {
        this.isSignedInSubject.next(isSignedIn);
      });

      // Actualizar estado inicial
      this.isSignedInSubject.next(this.authInstance.isSignedIn.get());

      console.log('✅ [GoogleDriveService] Google Drive API inicializada correctamente');
    } catch (error: any) {
      console.error('❌ [GoogleDriveService] Error al inicializar Google Drive API:', error);

      let errorMessage = 'Error al inicializar Google Drive API';

      if (error.details) {
        errorMessage += `: ${error.details}`;
      } else if (error.error) {
        errorMessage += `: ${error.error}`;
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      }

      // Agregar sugerencias comunes
      if (error.error === 'idpiframe_initialization_failed' || error.details?.includes('cookies')) {
        errorMessage += '. Verifica que las cookies de terceros estén habilitadas en tu navegador.';
      } else if (error.details?.includes('origin') || error.error?.includes('origin')) {
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
    return this.authInstance.signIn();
  }

  /**
   * Cerrar sesión
   */
  async signOut(): Promise<void> {
    if (this.authInstance) {
      return this.authInstance.signOut();
    }
  }

  /**
   * Verificar si el usuario está autenticado
   */
  isSignedIn(): boolean {
    return this.isSignedInSubject.value;
  }

  /**
   * Obtener información del usuario
   */
  getUserInfo(): any {
    if (!this.authInstance) return null;
    const user = this.authInstance.currentUser.get();
    const profile = user.getBasicProfile();
    return {
      id: profile.getId(),
      name: profile.getName(),
      email: profile.getEmail(),
      imageUrl: profile.getImageUrl()
    };
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
      throw new Error('User not signed in. Please sign in to Google Drive first.');
    }

    const metadata = {
      name: fileName,
      mimeType: mimeType,
      ...(folderId && { parents: [folderId] })
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileContent);

    const accessToken = gapi.auth.getToken().access_token;

    try {
      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          body: form
        }
      );

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ File uploaded to Google Drive:', result);
      return result;
    } catch (error) {
      console.error('❌ Error uploading file to Google Drive:', error);
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
