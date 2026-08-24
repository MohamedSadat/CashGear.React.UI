declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

declare module '*.css' {}

interface ImportMetaEnv { readonly DEV: boolean; }
interface ImportMeta { readonly env: ImportMetaEnv; }
