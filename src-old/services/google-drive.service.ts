import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { environment } from '../environments/environment';

declare var google: any;

@Injectable({
  providedIn: 'root'
})
export class GoogleDriveService {
  private readonly SCOPES = 'https://www.googleapis.com/auth/drive.file';

  private readonly CLIENT_ID = environment.googleClientId;
  private readonly API_KEY = environment.googleApiKey;

  private readonly MOBILE_CLIENT_ID = environment.googleMobileClientId;
  private readonly MOBILE_CLIENT_SECRET = environment.googleMobileClientSecret;
  private readonly MOBILE_REDIRECT_URI = `com.googleusercontent.apps.${environment.googleMobileClientId.split('.')[0]}:/oauth2redirect`;

  private isSignedInSubject = new BehaviorSubject<boolean>(false);
  public isSignedIn$ = this.isSignedInSubject.asObservable();

  private gisInitialized = false;
  private tokenClient: any;
  private accessToken: string | null = null;
  private readonly TOKEN_STORAGE_KEY = 'google_drive_access_token';

  private oauthResolve: (() => void) | null = null;
  private oauthReject: ((error: Error) => void) | null = null;
  private codeVerifier: string | null = null;

  constructor() {
    this.loadStoredToken();
    if (Capacitor.isNativePlatform()) {
      this.setupDeepLinkListener();
    }
  }

  // ─── Deep link listener for PKCE callback ────────────────────────────────

  private setupDeepLinkListener(): void {
    App.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith(this.MOBILE_REDIRECT_URI)) return;

      const queryString = url.includes('?') ? url.split('?')[1] : '';
      const params = new URLSearchParams(queryString);
      const code = params.get('code');
      const error = params.get('error');

      await Browser.close().catch(() => {});

      if (error) {
        this.oauthReject?.(new Error(`Autenticación rechazada: ${error}`));
      } else if (code && this.codeVerifier) {
        try {
          await this.exchangeCodeForToken(code, this.codeVerifier);
          this.oauthResolve?.();
        } catch (err: any) {
          this.oauthReject?.(err);
        }
      } else {
        this.oauthReject?.(new Error('No se recibió código de autorización'));
      }

      this.oauthResolve = null;
      this.oauthReject = null;
      this.codeVerifier = null;
    });
  }

  // ─── PKCE helpers ─────────────────────────────────────────────────────────

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  private async exchangeCodeForToken(code: string, verifier: string): Promise<void> {
    const body = new URLSearchParams({
      code,
      client_id: this.MOBILE_CLIENT_ID,
      redirect_uri: this.MOBILE_REDIRECT_URI,
      grant_type: 'authorization_code',
      code_verifier: verifier,
      client_secret: this.MOBILE_CLIENT_SECRET,
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Error al obtener token: ${err}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error_description || data.error);
    this.saveToken(data.access_token);
  }

  // ─── Drive REST API helpers (replaces gapi.client.drive.*) ───────────────

  private async driveList(params: Record<string, string>): Promise<any> {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    if (response.status === 401) {
      this.clearToken();
      throw Object.assign(new Error('Tu sesión de Google Drive ha expirado. Por favor cierra sesión y vuelve a iniciar sesión.'), { status: 401 });
    }
    if (!response.ok) throw new Error(`Drive API error ${response.status}: ${await response.text()}`);
    return response.json();
  }

  private async driveCreate(metadata: any): Promise<any> {
    const response = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });
    if (!response.ok) throw new Error(`Drive API error ${response.status}: ${await response.text()}`);
    return response.json();
  }

  private async driveGet(fileId: string, fields: string): Promise<any> {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=${fields}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    if (!response.ok) throw new Error(`Drive API error ${response.status}`);
    return response.json();
  }

  // ─── Token storage ────────────────────────────────────────────────────────

  private loadStoredToken(): void {
    const storedToken = localStorage.getItem(this.TOKEN_STORAGE_KEY);
    if (storedToken) {
      this.accessToken = storedToken;
      this.isSignedInSubject.next(true);
      console.log('✅ [GoogleDriveService] Token cargado desde localStorage');
    }
  }

  private saveToken(token: string): void {
    this.accessToken = token;
    localStorage.setItem(this.TOKEN_STORAGE_KEY, token);
    this.isSignedInSubject.next(true);
  }

  private clearToken(): void {
    this.accessToken = null;
    localStorage.removeItem(this.TOKEN_STORAGE_KEY);
    this.isSignedInSubject.next(false);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  }

  hasCredentials(): boolean {
    const clientId = Capacitor.isNativePlatform() ? this.MOBILE_CLIENT_ID : this.CLIENT_ID;
    const hasCredentials = !!clientId && !!this.API_KEY;
    if (!hasCredentials) {
      console.warn('⚠️ [GoogleDriveService] Credenciales no configuradas.');
    }
    return hasCredentials;
  }

  async initClient(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      return; // Native uses PKCE flow — no script setup needed
    }

    if (this.gisInitialized) return;

    if (!this.hasCredentials()) {
      throw new Error('Credenciales de Google Drive no configuradas. Por favor ve a Settings y configura el Client ID y API Key.');
    }

    // Load only GSI (Drive calls use fetch, not gapi)
    if (typeof google === 'undefined' || !google.accounts) {
      await this.loadScript('https://accounts.google.com/gsi/client');
    }

    this.initializeGISClient();
    this.gisInitialized = true;
  }

  async signIn(forceConsent: boolean = false): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      return this.signInMobile();
    }

    if (!this.gisInitialized) {
      await this.initClient();
    }

    if (this.accessToken && !forceConsent) {
      console.log('✅ [GoogleDriveService] Usando token existente');
      return;
    }

    console.log('🔐 [GoogleDriveService] Solicitando autenticación...');

    return new Promise((resolve, reject) => {
      try {
        const originalCallback = this.tokenClient.callback;
        this.tokenClient.callback = (response: any) => {
          this.tokenClient.callback = originalCallback;
          if (response.error) {
            reject(new Error(response.error));
            return;
          }
          this.saveToken(response.access_token);
          resolve();
        };
        this.tokenClient.requestAccessToken({ prompt: forceConsent ? 'consent' : '' });
      } catch (error) {
        reject(error);
      }
    });
  }

  private async signInMobile(): Promise<void> {
    this.codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(this.codeVerifier);

    const params = new URLSearchParams({
      client_id: this.MOBILE_CLIENT_ID,
      redirect_uri: this.MOBILE_REDIRECT_URI,
      response_type: 'code',
      scope: this.SCOPES,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'online',
    });

    return new Promise((resolve, reject) => {
      this.oauthResolve = resolve;
      this.oauthReject = reject;
      Browser.open({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
    });
  }

  async signOut(): Promise<void> {
    if (!this.accessToken) return;

    if (Capacitor.isNativePlatform()) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`, { method: 'POST' })
        .catch(() => {});
    } else {
      google.accounts.oauth2.revoke(this.accessToken, () => {
        console.log('✅ [GoogleDriveService] Sesión cerrada');
      });
    }

    this.clearToken();
  }

  isSignedIn(): boolean {
    return this.isSignedInSubject.value && !!this.accessToken;
  }

  private async ensureInitialized(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      return; // Native: token is managed by PKCE flow
    }
    if (!this.gisInitialized) {
      await this.initClient();
    }
  }

  // ─── Drive operations ─────────────────────────────────────────────────────

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
          headers: { 'Authorization': `Bearer ${this.accessToken}` },
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
      console.error('❌ [GoogleDriveService] Error al subir archivo:', error);
      throw error;
    }
  }

  async findFileByName(fileName: string): Promise<string | null> {
    await this.ensureInitialized();

    if (!this.accessToken) {
      throw new Error('No hay token de acceso. Por favor inicia sesión en Google Drive primero.');
    }

    try {
      console.log(`🔍 [GoogleDriveService] Buscando archivo: ${fileName}`);

      const result = await this.driveList({
        q: `name='${fileName}' and trashed=false and 'root' in parents`,
        fields: 'files(id, name, webViewLink)',
        spaces: 'drive'
      });

      console.log('📋 [GoogleDriveService] Respuesta de API:', {
        filesEncontrados: result.files?.length || 0,
        files: result.files
      });

      if (!result.files || result.files.length === 0) {
        console.log(`ℹ️ [GoogleDriveService] Archivo no encontrado: ${fileName}`);
        return null;
      }

      const file = result.files[0];
      if (!file?.id) {
        throw new Error(`Google Drive retornó un archivo sin ID: ${JSON.stringify(file)}`);
      }

      const fileId = file.id;
      if (!fileId || fileId.trim() === '' || fileId === '.' || fileId === 'null' || fileId === 'undefined') {
        throw new Error(`Google Drive API retornó un fileId inválido: "${fileId}".`);
      }

      console.log(`✅ [GoogleDriveService] Archivo encontrado: ${fileName} (ID: ${fileId})`);
      return fileId;
    } catch (error: any) {
      if (error.status === 401) throw error;
      console.error('❌ [GoogleDriveService] Error buscando archivo:', error);
      throw error;
    }
  }

  async updateFile(fileId: string, fileContent: Blob, mimeType: string): Promise<any> {
    await this.ensureInitialized();

    if (!this.isSignedIn()) {
      throw new Error('Usuario no autenticado. Por favor inicia sesión en Google Drive primero.');
    }

    if (!fileId || fileId.trim() === '' || fileId === '.' || fileId === 'null' || fileId === 'undefined') {
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
        throw new Error(`Fallo al actualizar archivo: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ [GoogleDriveService] Archivo actualizado (PATCH exitoso)');

      try {
        const fileInfo = await this.driveGet(fileId, 'id,name,webViewLink');
        console.log('✅ [GoogleDriveService] Info del archivo actualizado:', fileInfo);
        return fileInfo;
      } catch {
        return result;
      }
    } catch (error) {
      console.error('❌ [GoogleDriveService] Error al actualizar archivo:', error);
      throw error;
    }
  }

  async uploadOrUpdateFile(fileName: string, fileContent: Blob, mimeType: string): Promise<any> {
    await this.ensureInitialized();

    if (!this.isSignedIn()) {
      throw new Error('Usuario no autenticado. Por favor inicia sesión en Google Drive primero.');
    }

    try {
      console.log(`📂 [GoogleDriveService] uploadOrUpdateFile iniciado para: ${fileName}`);
      const existingFileId = await this.findFileByName(fileName);

      if (existingFileId) {
        console.log(`🔄 [GoogleDriveService] Archivo existe, actualizando: ${fileName} (ID: ${existingFileId})`);
        return await this.updateFile(existingFileId, fileContent, mimeType);
      } else {
        console.log(`📝 [GoogleDriveService] Archivo no existe, creando nuevo: ${fileName}`);
        return await this.uploadFile(fileName, fileContent, mimeType);
      }
    } catch (error) {
      console.error('❌ [GoogleDriveService] Error en uploadOrUpdateFile:', error);
      throw error;
    }
  }

  async findOrCreateFolder(folderName: string, parentId?: string): Promise<string> {
    await this.ensureInitialized();

    if (!this.isSignedIn()) {
      throw new Error('Usuario no autenticado. Por favor inicia sesión en Google Drive primero.');
    }

    try {
      let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
      query += parentId ? ` and '${parentId}' in parents` : ` and 'root' in parents`;

      const listResult = await this.driveList({ q: query, fields: 'files(id, name)', spaces: 'drive' });

      if (listResult.files && listResult.files.length > 0) {
        console.log(`✅ [GoogleDriveService] Carpeta encontrada: ${folderName} (ID: ${listResult.files[0].id})`);
        return listResult.files[0].id;
      }

      const folderMetadata: any = { name: folderName, mimeType: 'application/vnd.google-apps.folder' };
      if (parentId) folderMetadata.parents = [parentId];

      const folder = await this.driveCreate(folderMetadata);
      console.log(`✅ [GoogleDriveService] Carpeta creada: ${folderName} (ID: ${folder.id})`);
      return folder.id;
    } catch (error) {
      console.error(`❌ [GoogleDriveService] Error al buscar/crear carpeta ${folderName}:`, error);
      throw error;
    }
  }

  async getOrCreateBudgetFolder(): Promise<string> {
    return this.findOrCreateFolder('Budget Tracker');
  }

  async listBudgetFiles(): Promise<any[]> {
    try {
      const folderId = await this.getOrCreateBudgetFolder();
      const result = await this.driveList({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, webViewLink, createdTime)',
        orderBy: 'createdTime desc',
        pageSize: '50'
      });
      return result.files || [];
    } catch (error) {
      console.error('❌ Error listing files:', error);
      throw error;
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.body.appendChild(script);
    });
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
      let errorMessage = 'Error al inicializar autenticación de Google';
      if (error.message) errorMessage += `: ${error.message}`;
      if (error.message?.includes('origin')) {
        errorMessage += '. Verifica que http://localhost:4200 esté autorizado en Google Cloud Console.';
      }
      throw new Error(errorMessage);
    }
  }
}
