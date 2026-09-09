import { mockSupabase, mockFunction } from '../support/mock-supabase';
import { OWNER_PROFILE, baseClients, baseProducts } from '../support/fixtures';

const DRAFT_QUOTE = {
  id: 'quo-1',
  client_id: 'cli-1',
  items: [{ product_id: 'prod-1', quantity: 10, unit_price: 3500 }],
  valid_until: '2026-02-01',
  status: 'draft',
  discount_percent: 0,
  created_at: '2026-01-04T00:00:00.000Z',
};

const APPROVED_QUOTE = { ...DRAFT_QUOTE, id: 'quo-2', status: 'approved' };

function seedQuotes(quotes: unknown[]) {
  mockSupabase({
    profiles: [OWNER_PROFILE],
    clients: baseClients(),
    products: baseProducts(),
    quotes,
  });
}

describe('Presupuestos', () => {
  it('lista los presupuestos con su total y estado', () => {
    seedQuotes([DRAFT_QUOTE]);
    cy.loginAs('/presupuestos');

    cy.contains('h1', 'Presupuestos').should('be.visible');
    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('$35000.00');
      cy.contains('Borrador');
    });
  });

  it('crea un presupuesto nuevo', () => {
    seedQuotes([]);
    cy.loginAs('/presupuestos');

    cy.contains('button', 'Nuevo presupuesto').click();
    cy.get('form').within(() => {
      cy.get('select').eq(0).select('Juan Pérez');
      cy.contains('button', 'Guardar presupuesto').click();
    });

    cy.wait('@supabaseRest');
    cy.contains('h2', 'Nuevo presupuesto').should('not.exist');
    cy.contains('tr', 'Juan Pérez').should('be.visible');
  });

  it('aprueba un presupuesto en borrador', () => {
    seedQuotes([DRAFT_QUOTE]);
    cy.loginAs('/presupuestos');

    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('button', 'Aprobar').click();
    });

    cy.wait('@supabaseRest');
    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('Aprobado');
    });
  });

  it('convierte un presupuesto aprobado en venta directa', () => {
    seedQuotes([APPROVED_QUOTE]);
    mockFunction('convert-quote', { statusCode: 200, body: { data: { ok: true } } });
    cy.loginAs('/presupuestos');

    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('button', 'Convertir a venta directa').click();
    });

    cy.wait('@fn_convert-quote').its('request.body').should('deep.equal', { quote_id: 'quo-2', target: 'sale' });
  });

  it('muestra un error si falla el guardado de un presupuesto nuevo', () => {
    seedQuotes([]);
    cy.loginAs('/presupuestos');

    cy.intercept('POST', '**/rest/v1/quotes*', { statusCode: 500, body: { message: 'unexpected error' } }).as(
      'insertQuoteFails'
    );

    cy.contains('button', 'Nuevo presupuesto').click();
    cy.get('form').within(() => {
      cy.get('select').eq(0).select('Juan Pérez');
      cy.contains('button', 'Guardar presupuesto').click();
    });

    cy.wait('@insertQuoteFails');
    cy.contains('No se pudo guardar el presupuesto. Verificá tu conexión.').should('be.visible');
    cy.contains('h2', 'Nuevo presupuesto').should('exist');
  });

  it('muestra el error que devuelve la función si la conversión falla', () => {
    seedQuotes([APPROVED_QUOTE]);
    mockFunction('convert-quote', { statusCode: 200, body: { error: 'No hay stock suficiente para convertir' } });
    cy.loginAs('/presupuestos');

    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('button', 'Convertir a venta directa').click();
    });

    cy.wait('@fn_convert-quote');
    cy.contains('No hay stock suficiente para convertir').should('be.visible');
    // el presupuesto sigue aprobado, no pasó a "Convertido"
    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('Aprobado');
    });
  });
});
