// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    interface Locals {
      user?: {
        id: number;
        username: string;
        displayName: string;
        favoriteTab: string | null;
      };
      admin?: boolean;
    }
  }
}

export {};
