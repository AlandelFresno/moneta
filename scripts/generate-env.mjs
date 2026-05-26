import { writeFileSync, mkdirSync } from 'fs';

const content = `export const environment = {
  production: ${process.env['NODE_ENV'] === 'production'},
  googleClientId: '${process.env['GOOGLE_CLIENT_ID'] ?? ''}',
  googleApiKey: '${process.env['GOOGLE_API_KEY'] ?? ''}',
  googleMobileClientId: '${process.env['GOOGLE_MOBILE_CLIENT_ID'] ?? ''}',
  googleMobileClientSecret: '${process.env['GOOGLE_MOBILE_CLIENT_SECRET'] ?? ''}',
};
`;

mkdirSync('src/environments', { recursive: true });
writeFileSync('src/environments/environment.ts', content);
console.log('environment.ts generated');
