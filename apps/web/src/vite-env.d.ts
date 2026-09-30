/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARCGIS_API_KEY?: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_WS_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
