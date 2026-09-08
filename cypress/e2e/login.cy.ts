import { mockSupabase } from '../support/mock-supabase';
import { OWNER_PROFILE } from '../support/fixtures';

function mockDashboardData() {
  mockSupabase({
    profiles: [OWNER_PROFILE],
    products: [],
    stockpiles: [],
    sales: [],
    stock_movements: [],
    delivery_notes: [],
  });
}

describe('Login', () => {
  it('redirige a /login a quien no tiene sesión iniciada', () => {
    cy.visit('/productos');
    cy.location('pathname').should('eq', '/login');
  });

  it('permite iniciar sesión con credenciales válidas y muestra el dashboard', () => {
    mockDashboardData();
    cy.intercept('POST', '**/auth/v1/token?grant_type=password', {
      statusCode: 200,
      body: {
        access_token: 'test-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        user: {
          id: OWNER_PROFILE.id,
          aud: 'authenticated',
          role: 'authenticated',
          email: OWNER_PROFILE.email,
          app_metadata: { provider: 'email' },
          user_metadata: {},
          created_at: '2026-01-01T00:00:00.000Z',
        },
      },
    }).as('signIn');

    cy.visit('/login');
    cy.get('input[type="email"]').type(OWNER_PROFILE.email);
    cy.get('input[type="password"]').type('password123');
    cy.contains('button', 'Ingresar').click();

    cy.wait('@signIn');
    cy.location('pathname').should('eq', '/');
    cy.contains('h1', 'Dashboard').should('be.visible');
  });

  it('muestra un error con credenciales inválidas y no navega', () => {
    cy.intercept('POST', '**/auth/v1/token?grant_type=password', {
      statusCode: 400,
      body: { code: 400, msg: 'Invalid login credentials' },
    }).as('signInFailed');

    cy.visit('/login');
    cy.get('input[type="email"]').type('owner@test.com');
    cy.get('input[type="password"]').type('wrong-password');
    cy.contains('button', 'Ingresar').click();

    cy.wait('@signInFailed');
    cy.contains('Email o contraseña incorrectos').should('be.visible');
    cy.location('pathname').should('eq', '/login');
  });
});
