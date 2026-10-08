/// <reference types="vite/client" />

// Types pour les variables d'environnement Vite
declare interface ImportMetaEnv {
  readonly VITE_API_MOVIES_URL: string;
  readonly VITE_API_SLOTS_URL: string;
  readonly VITE_SSE_EVENTS_URL: string;
}

// Types pour les variables d'environnement
declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
