import { mockSupabase } from '../support/mock-supabase';
import { OWNER_PROFILE, baseSuppliers } from '../support/fixtures';

describe('Proveedores', () => {
  it('lista los proveedores existentes', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], suppliers: baseSuppliers() });
    cy.loginAs('/proveedores');

    cy.contains('h1', 'Proveedores').should('be.visible');
    cy.contains('td', 'Loma Negra S.A.').should('be.visible');
    cy.contains('td', '30-12345678-9').should('be.visible');
  });

  it('crea un proveedor nuevo', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], suppliers: baseSuppliers() });
    cy.loginAs('/proveedores');

    cy.contains('button', 'Nuevo proveedor').click();
    cy.get('form').within(() => {
      cy.contains('label', 'Nombre').next('input').type('Ferrum S.A.');
      cy.contains('label', 'CUIT').next('input').type('30-98765432-1');
      cy.contains('label', 'Teléfono').next('input').type('1144445555');
      cy.contains('button', 'Guardar proveedor').click();
    });

    cy.wait('@supabaseRest');
    cy.contains('h2', 'Nuevo proveedor').should('not.exist');
    cy.contains('td', 'Ferrum S.A.').should('be.visible');
  });

  it('filtra proveedores por el buscador', () => {
    mockSupabase({
      profiles: [OWNER_PROFILE],
      suppliers: [
        ...baseSuppliers(),
        { id: 'sup-2', name: 'Ferrum S.A.', tax_id: '30-98765432-1', phone: '1144445555', created_at: '2026-01-01T00:00:00.000Z' },
      ],
    });
    cy.loginAs('/proveedores');

    cy.get('input[placeholder*="Buscar por nombre"]').type('ferrum');
    cy.contains('td', 'Ferrum S.A.').should('be.visible');
    cy.contains('td', 'Loma Negra S.A.').should('not.exist');
  });

  it('muestra un error si falla el guardado y no cierra el formulario', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], suppliers: baseSuppliers() });
    cy.loginAs('/proveedores');

    cy.intercept('POST', '**/rest/v1/suppliers*', { statusCode: 500, body: { message: 'unexpected error' } }).as(
      'insertSupplierFails'
    );

    cy.contains('button', 'Nuevo proveedor').click();
    cy.get('form').within(() => {
      cy.contains('label', 'Nombre').next('input').type('Ferrum S.A.');
      cy.contains('button', 'Guardar proveedor').click();
    });

    cy.wait('@insertSupplierFails');
    cy.contains('No se pudo guardar el proveedor. Verificá tu conexión.').should('be.visible');
    cy.contains('h2', 'Nuevo proveedor').should('exist');
    cy.contains('td', 'Ferrum S.A.').should('not.exist');
  });

  it('muestra la cuenta corriente de cada proveedor en el listado', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], suppliers: [{ ...baseSuppliers()[0], account_balance: 80000 }] });
    cy.loginAs('/proveedores');

    cy.contains('tr', 'Loma Negra S.A.').within(() => {
      cy.contains('le debés $80.000,00');
      cy.contains('a', 'Ver cuenta').should('have.attr', 'href', '/proveedores/sup-1');
    });
  });

  it('muestra arriba el total que se les debe a los proveedores', () => {
    mockSupabase({
      profiles: [OWNER_PROFILE],
      suppliers: [
        { ...baseSuppliers()[0], account_balance: 80000 },
        { id: 'sup-2', name: 'Ferrum S.A.', tax_id: null, phone: null, account_balance: 20000, created_at: '2026-01-01T00:00:00.000Z' },
        { id: 'sup-3', name: 'Arenera Sur', tax_id: null, phone: null, account_balance: -5000, created_at: '2026-01-01T00:00:00.000Z' },
      ],
    });
    cy.loginAs('/proveedores');

    cy.contains('Total que les debés a proveedores').parent().should('contain', '$100.000,00').and('contain', '2 proveedores con deuda');
    cy.contains('tr', 'Arenera Sur').should('contain', 'saldo a tu favor $5.000,00');
  });

  it('edita un proveedor con click en la fila', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], suppliers: baseSuppliers() });
    cy.intercept('PATCH', '**/rest/v1/suppliers*').as('updateSupplier');
    cy.loginAs('/proveedores');

    cy.contains('tr', 'Loma Negra S.A.').click();
    cy.contains('h2', 'Editar proveedor').should('be.visible');
    cy.get('form').within(() => {
      cy.contains('label', 'Teléfono').next('input').should('have.value', '1122334455').clear().type('1199998888');
      cy.contains('button', 'Guardar cambios').click();
    });

    cy.wait('@updateSupplier').its('request.body').should((body) => {
      expect(body).to.include({ phone: '1199998888' });
      expect(body).not.to.have.property('account_balance');
    });
    cy.contains('tr', 'Loma Negra S.A.').should('contain', '1199998888');
  });

  describe('cuenta corriente del proveedor', () => {
    const PURCHASE = {
      id: 'pur-1',
      supplier_id: 'sup-1',
      purchase_date: '2026-01-10',
      payment_method: 'cash',
      items: [],
      total_amount: 100000,
      amount_paid: 20000,
      account_balance_change: 80000,
      notes: null,
      created_by: null,
      created_at: '2026-01-10T12:00:00.000Z',
    };
    const PAYMENT = {
      id: 'spay-1',
      supplier_id: 'sup-1',
      payment_date: '2026-01-15',
      method: 'transfer',
      amount: 30000,
      notes: 'Transf. 123',
      created_by: null,
      created_at: '2026-01-15T12:00:00.000Z',
    };

    function seedAccount() {
      mockSupabase({
        profiles: [OWNER_PROFILE],
        suppliers: [{ ...baseSuppliers()[0], account_balance: 50000 }],
        purchases: [PURCHASE],
        supplier_payments: [PAYMENT],
      });
    }

    it('muestra el saldo y los movimientos con el saldo después de cada uno', () => {
      seedAccount();
      cy.loginAs('/proveedores/sup-1');

      cy.contains('h1', 'Loma Negra S.A.').should('be.visible');
      cy.contains('Cuenta corriente: le debés $50.000,00').should('be.visible');
      cy.contains('tr', 'Pago').within(() => {
        cy.contains('Transferencia $30.000,00 — Transf. 123');
        cy.contains('-$30.000,00');
        cy.contains('$50.000,00');
      });
      cy.contains('tr', 'Compra').within(() => {
        cy.contains('Total $100.000,00 — pagado $20.000,00');
        cy.contains('+$80.000,00');
        cy.contains('$80.000,00');
      });
    });

    it('un pago anulado (cheque rechazado) se muestra pero no descuenta deuda', () => {
      mockSupabase({
        profiles: [OWNER_PROFILE],
        suppliers: [{ ...baseSuppliers()[0], account_balance: 80000 }],
        purchases: [PURCHASE],
        supplier_payments: [
          { ...PAYMENT, method: 'checks', notes: 'Cheque N.º 00012345 — Banco Galicia', voided_at: '2026-01-20T12:00:00.000Z', void_reason: 'Cheque rechazado' },
        ],
      });
      cy.loginAs('/proveedores/sup-1');

      cy.contains('tr', 'Pago anulado').within(() => {
        cy.contains('Cheque rechazado');
        cy.contains('td', '—');
        cy.contains('$80.000,00');
      });
    });

    it('registra un pago que arranca con el saldo adeudado', () => {
      seedAccount();
      cy.intercept('POST', '**/rest/v1/supplier_payments*').as('insertPayment');
      cy.loginAs('/proveedores/sup-1');

      cy.contains('button', 'Registrar pago').click();
      cy.get('form').within(() => {
        cy.contains('label', 'Monto').next('input').should('have.value', '50000').clear().type('20000');
        cy.contains('label', 'Forma de pago').next('select').select('Transferencia');
        cy.contains('Cuenta corriente después del pago: le debés $30.000,00').should('be.visible');
        cy.contains('button', 'Registrar pago').click();
      });

      cy.wait('@insertPayment').its('request.body').should('deep.include', {
        supplier_id: 'sup-1',
        method: 'transfer',
        amount: 20000,
      });
      cy.contains('h2', 'Nuevo pago').should('not.exist');
    });
  });
});
