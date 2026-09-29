import { mockSupabase } from '../support/mock-supabase';
import { OWNER_PROFILE, baseClients, baseSuppliers } from '../support/fixtures';

const CHECK_IN_WALLET = {
  id: 'chk-1',
  client_id: 'cli-1',
  sale_id: null,
  check_number: '00012345',
  bank: 'Banco Galicia',
  amount: 50000,
  holder_name: 'Materiales del Norte SA',
  holder_tax_id: '30-33333333-3',
  emission_date: '2025-12-28',
  issue_date: '2026-01-01',
  due_date: '2026-01-20',
  is_deferred: false,
  status: 'in_wallet',
  notes: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('Valores', () => {
  it('lista los cheques con su estado', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients(), checks: [CHECK_IN_WALLET] });
    cy.loginAs('/valores');

    cy.contains('h1', 'Valores').should('be.visible');
    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('Banco Galicia');
      cy.contains('00012345');
      cy.contains('Materiales del Norte SA');
      cy.contains('CUIT 30-33333333-3');
      cy.contains('28/12/2025');
      cy.contains('En cartera');
    });
  });

  it('filtra cheques por cliente, banco o número', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients(), checks: [CHECK_IN_WALLET] });
    cy.loginAs('/valores');

    cy.get('input[placeholder*="Buscar por cliente"]').type('no existe ningún cheque así');
    cy.contains('Ningún cheque coincide con la búsqueda.').should('be.visible');
  });

  it('carga un cheque nuevo', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients(), checks: [] });
    cy.loginAs('/valores');

    cy.contains('button', 'Nuevo cheque').click();
    cy.get('form').within(() => {
      cy.contains('label', 'Banco').next('input').type('Banco Nación');
      cy.contains('label', 'N.º de cheque').next('input').type('00098765');
      cy.contains('label', 'Titular del cheque').next('input').type('Juan Pérez');
      cy.contains('label', 'CUIT del titular').next('input').type('20-11111111-1');
      cy.contains('label', 'Fecha de emisión').next('input').type('2026-01-15');
      cy.contains('label', 'Monto').next('input').type('20000');
      cy.contains('label', 'Fecha de cobro').next('input').type('2026-03-01');
      cy.contains('button', 'Guardar cheque').click();
    });

    cy.wait('@supabaseRest');
    cy.contains('h2', 'Nuevo cheque').should('not.exist');
    cy.contains('td', 'Banco Nación').should('be.visible');
  });

  it('avanza el estado de un cheque de En cartera a Depositado', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients(), checks: [CHECK_IN_WALLET] });
    cy.loginAs('/valores');

    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('button', 'Depositar').click();
    });

    cy.wait('@supabaseRest');
    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('Depositado');
    });
  });

  it('al cargar un cheque muestra la cuenta corriente del cliente antes y después', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients(), checks: [] });
    cy.loginAs('/valores');

    cy.contains('button', 'Nuevo cheque').click();
    cy.get('form').within(() => {
      cy.get('select').first().select('Constructora Sur SRL');
      cy.contains('Cuenta corriente actual:').should('contain', 'debe $15.000,00');
      cy.contains('label', 'Monto').next('input').type('20000');
      cy.contains('después del cheque').parent().should('contain', 'saldo a favor $5.000,00');
    });
  });

  it('muestra un error si falla el guardado y no cierra el formulario', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients(), checks: [] });
    cy.loginAs('/valores');

    cy.intercept('POST', '**/rest/v1/checks*', { statusCode: 500, body: { message: 'unexpected error' } }).as(
      'insertCheckFails'
    );

    cy.contains('button', 'Nuevo cheque').click();
    cy.get('form').within(() => {
      cy.contains('label', 'Banco').next('input').type('Banco Nación');
      cy.contains('label', 'N.º de cheque').next('input').type('00098765');
      cy.contains('label', 'Titular del cheque').next('input').type('Juan Pérez');
      cy.contains('label', 'CUIT del titular').next('input').type('20-11111111-1');
      cy.contains('label', 'Fecha de emisión').next('input').type('2026-01-15');
      cy.contains('label', 'Monto').next('input').type('20000');
      cy.contains('label', 'Fecha de cobro').next('input').type('2026-03-01');
      cy.contains('button', 'Guardar cheque').click();
    });

    cy.wait('@insertCheckFails');
    cy.contains('No se pudo guardar el cheque. Verificá tu conexión.').should('be.visible');
    cy.contains('h2', 'Nuevo cheque').should('exist');
  });

  it('entrega un cheque a un proveedor elegido y lo registra como pago', () => {
    mockSupabase({
      profiles: [OWNER_PROFILE],
      clients: baseClients(),
      suppliers: [{ ...baseSuppliers()[0], account_balance: 80000 }],
      checks: [CHECK_IN_WALLET],
    });
    cy.intercept('PATCH', '**/rest/v1/checks*').as('updateCheck');
    cy.loginAs('/valores');

    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('button', 'Entregar a proveedor').click();
    });
    cy.contains('Entregar cheque N.º 00012345').should('be.visible');
    cy.contains('label', 'Proveedor').find('select').should('have.value', 'sup-1');
    cy.contains('Cuenta corriente con Loma Negra S.A.: le debés $80.000,00 → le debés $30.000,00').should('be.visible');
    cy.contains('button', /^Entregar$/).click();

    cy.wait('@updateCheck').its('request.body').should('deep.equal', {
      status: 'delivered',
      delivered_supplier_id: 'sup-1',
      delivered_as_payment: true,
    });
    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('Entregado a proveedor');
      cy.contains('→ Loma Negra S.A.');
      cy.contains('button', 'Marcar cobrado');
      cy.contains('button', 'Marcar devuelto');
      cy.contains('button', 'Marcar rechazado');
    });
  });

  it('se puede entregar sin registrarlo como pago (si ya pagó una compra)', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients(), suppliers: baseSuppliers(), checks: [CHECK_IN_WALLET] });
    cy.intercept('PATCH', '**/rest/v1/checks*').as('updateCheck');
    cy.loginAs('/valores');

    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('button', 'Entregar a proveedor').click();
    });
    cy.contains('label', 'Registrar como pago').find('input').uncheck();
    cy.contains('Destildalo si el cheque ya se contó como pago').should('be.visible');
    cy.contains('button', /^Entregar$/).click();

    cy.wait('@updateCheck').its('request.body.delivered_as_payment').should('equal', false);
  });

  it('marcar devuelto un cheque entregado pide confirmación y avisa que vuelve a la cuenta del cliente y del proveedor', () => {
    const delivered = {
      ...CHECK_IN_WALLET,
      status: 'delivered',
      delivered_supplier_id: 'sup-1',
      delivered_as_payment: true,
      supplier_payment_id: 'spay-1',
    };
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients(), suppliers: baseSuppliers(), checks: [delivered] });
    cy.intercept('PATCH', '**/rest/v1/checks*').as('updateCheck');
    cy.loginAs('/valores');

    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('button', 'Marcar devuelto').click();
    });
    cy.contains('¿Marcar devuelto el cheque N.º 00012345?')
      .should('contain', 'Se le vuelven a sumar $50.000,00 a la cuenta corriente de Juan Pérez.')
      .and('contain', 'Además se anula el pago a Loma Negra S.A. y le volvés a deber ese monto.');
    cy.contains('button', 'Sí, marcar devuelto').click();

    cy.wait('@updateCheck').its('request.body').should('deep.equal', { status: 'returned' });
    cy.contains('tr', 'Juan Pérez').contains('Devuelto');
  });

  it('cancelar el rechazo no cambia el estado', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients(), suppliers: baseSuppliers(), checks: [CHECK_IN_WALLET] });
    cy.loginAs('/valores');

    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('button', 'Marcar rechazado').click();
    });
    cy.contains('¿Marcar rechazado el cheque N.º 00012345?').should('be.visible');
    cy.contains('button', 'Cancelar').click();

    cy.contains('¿Marcar rechazado').should('not.exist');
    cy.contains('tr', 'Juan Pérez').contains('En cartera');
  });

  it('edita los datos de un cheque en cartera, incluido el monto', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients(), suppliers: baseSuppliers(), checks: [CHECK_IN_WALLET] });
    cy.intercept('PATCH', '**/rest/v1/checks*').as('updateCheck');
    cy.loginAs('/valores');

    cy.contains('tr', 'Juan Pérez').click();
    cy.contains('h2', 'Editar cheque N.º 00012345').should('be.visible');
    cy.get('form').within(() => {
      cy.contains('label', 'Banco').next('input').should('have.value', 'Banco Galicia').clear().type('Banco Macro');
      cy.contains('label', 'Monto').next('input').should('have.value', '50000').clear().type('45000');
      // Juan Pérez está al día y el cheque ya le había descontado 50.000: con 45.000 queda debiendo 5.000
      cy.contains('después de guardar').parent().should('contain', 'debe $5.000,00');
      cy.contains('button', 'Guardar cambios').click();
    });

    cy.wait('@updateCheck').its('request.body').should('deep.include', { bank: 'Banco Macro', amount: 45000, client_id: 'cli-1' });
    cy.contains('h2', 'Editar cheque').should('not.exist');
    cy.contains('tr', 'Juan Pérez').should('contain', 'Banco Macro').and('contain', '$45.000,00');
  });

  it('en un cheque de venta no deja cambiar monto ni cliente', () => {
    mockSupabase({
      profiles: [OWNER_PROFILE],
      clients: baseClients(),
      suppliers: baseSuppliers(),
      checks: [{ ...CHECK_IN_WALLET, sale_id: 'sale-1' }],
    });
    cy.intercept('PATCH', '**/rest/v1/checks*').as('updateCheck');
    cy.loginAs('/valores');

    cy.contains('tr', 'Juan Pérez').click();
    cy.get('form').within(() => {
      cy.contains('label', 'Monto').next('input').should('be.disabled');
      cy.contains('label', 'Cliente (quién lo dio)').next('select').should('be.disabled');
      cy.contains('este cheque vino de una venta').should('be.visible');
      cy.contains('label', 'N.º de cheque').next('input').clear().type('00099999');
      cy.contains('button', 'Guardar cambios').click();
    });

    cy.wait('@updateCheck').its('request.body').should((body) => {
      expect(body).to.include({ check_number: '00099999' });
      expect(body).not.to.have.property('amount');
      expect(body).not.to.have.property('client_id');
    });
  });

  it('los botones de estado de una fila no abren la edición', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients(), suppliers: baseSuppliers(), checks: [CHECK_IN_WALLET] });
    cy.loginAs('/valores');

    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('button', 'Depositar').click();
    });
    cy.contains('tr', 'Juan Pérez').contains('Depositado');
    cy.contains('h2', 'Editar cheque').should('not.exist');
  });

  it('no muestra botón Editar: se edita con click en la fila', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients(), suppliers: baseSuppliers(), checks: [CHECK_IN_WALLET] });
    cy.loginAs('/valores');

    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('button', 'Editar').should('not.exist');
    });
  });

  it('edita un cheque emitido con click en la fila', () => {
    mockSupabase({
      profiles: [OWNER_PROFILE],
      own_checks: [
        {
          id: 'own-1',
          payee: 'Loma Negra S.A.',
          check_number: '00070001',
          bank: 'Banco Nación',
          amount: 90000,
          issue_date: '2026-01-05',
          due_date: '2026-02-05',
          status: 'pending',
          notes: null,
          created_at: '2026-01-05T00:00:00.000Z',
        },
      ],
    });
    cy.intercept('PATCH', '**/rest/v1/own_checks*').as('updateOwnCheck');
    cy.loginAs('/valores?tab=emitidos');

    cy.contains('tr', 'Loma Negra S.A.').click();
    cy.contains('h2', 'Editar cheque emitido N.º 00070001').should('be.visible');
    cy.get('form').within(() => {
      cy.contains('label', 'Monto').next('input').should('have.value', '90000').clear().type('95000');
      cy.contains('button', 'Guardar cambios').click();
    });

    cy.wait('@updateOwnCheck').its('request.body').should('deep.include', { amount: 95000, payee: 'Loma Negra S.A.' });
    cy.contains('tr', 'Loma Negra S.A.').should('contain', '$95.000,00');
  });
});
