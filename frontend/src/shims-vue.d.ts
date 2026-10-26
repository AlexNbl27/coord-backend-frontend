/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-unused-vars
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
