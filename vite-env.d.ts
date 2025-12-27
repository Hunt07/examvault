/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_KEY: string;
  // Add other VITE_ environment variables here if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
