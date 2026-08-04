import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';
import { seedDevDataIfEmpty } from './app/core/utils/dev-seed.util';

if (!environment.production) {
  seedDevDataIfEmpty();
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
