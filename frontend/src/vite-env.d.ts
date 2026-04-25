/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_PROXY?: string;
  /** If "true" or "1", bind Socket.IO to the page origin (use with reverse proxy to API). */
  readonly VITE_SOCKET_SAME_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.md?raw" {
  const content: string;
  export default content;
}

declare module "*.md" {
  const content: string;
  export default content;
}
