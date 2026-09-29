import { OWNER_PROFILE, type TestProfile } from './fixtures';

// Coincide con `sb-${new URL(VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`,
// la storageKey que arma @supabase/supabase-js para VITE_SUPABASE_URL=https://test.supabase.co
// (ver .env.test). Pre-sembrar esta key en localStorage antes de que la app monte le evita a
// getSession() cualquier llamada de red: lee la sesión directo de storage y no expira en la
// ventana del test, así que AuthContext arranca autenticado.
const AUTH_STORAGE_KEY = 'sb-test-auth-token';

function fakeSession(profile: TestProfile) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    access_token: 'test-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: nowSeconds + 3600,
    refresh_token: 'test-refresh-token',
    user: {
      id: profile.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: profile.email,
      app_metadata: { provider: 'email' },
      user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z',
    },
  };
}

// Misma key que STORAGE_KEY en src/context/ThemeContext.tsx.
const THEME_STORAGE_KEY = 'corralon-theme';

Cypress.Commands.add('loginAs', (path = '/', profile: TestProfile = OWNER_PROFILE, theme: 'light' | 'dark' = 'light') => {
  const session = fakeSession(profile);
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      // Tema fijo: si no, ThemeContext toma el del sistema operativo y los tests
      // se comportan distinto en una Mac en modo oscuro que en CI (Linux, modo claro).
      win.localStorage.setItem(THEME_STORAGE_KEY, theme);
    },
  });
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Simula una sesión ya iniciada seteando localStorage antes de visitar `path`,
       * sin pasar por el formulario de login ni pegarle a Supabase Auth.
       */
      loginAs(path?: string, profile?: TestProfile, theme?: 'light' | 'dark'): Chainable<void>;
    }
  }
}
