/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_ENV: string;
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
  readonly VITE_DISPUTE_TEST_TOOLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}
declare module '*.svg' {
  const content: string;
  export default content;
}
