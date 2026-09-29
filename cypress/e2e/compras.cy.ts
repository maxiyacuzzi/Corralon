import { mockSupabase, mockFunction } from '../support/mock-supabase';
import { OWNER_PROFILE, baseProducts, baseSuppliers } from '../support/fixtures';

const PURCHASE = {
  id: 'pur-1',
  supplier_id: 'sup-1',
  purchase_date: '2026-01-10',
  payment_method: 'transfer',
  items: [{ product_id: 'prod-1', quantity: 20, unit: 'bulk', unit_cost: 2500, retail_quantity: 500 }],
  total_amount: 50000,
  notes: 'Factura A 0001-00001234',
  created_by: null,
  created_at: '2026-01-10T12:00:00.000Z',
};

function seedPurchases(purchases: unknown[] = []) {
  mockSupabase({
    profiles: [OWNER_PROFILE],
    suppliers: baseSuppliers(),
    products: baseProducts(),
    purchases,
  });
}

describe('Compras', () => {
  it('lista las compras con fecha, proveedor, productos, forma de pago y total', () => {
    seedPurchases([PURCHASE]);
    cy.loginAs('/compras');

    cy.contains('h1', 'Compras').should('be.visible');
    cy.contains('tr', 'Factura A 0001-00001234').within(() => {
      cy.contains('10/1/2026');
      cy.contains('20 bolsa Cemento Loma Negra');
      cy.contains('Transferencia');
      cy.contains('$50.000,00');
    });
  });

  it('registra una compra vía la Edge Function con los productos y lo que suman al stock', () => {
    seedPurchases();
    mockFunction('register-purchase', { statusCode: 200, body: { data: { ok: true } } });
    cy.loginAs('/compras');

    cy.contains('button', 'Nueva compra').click();
    cy.get('form').within(() => {
      cy.contains('label', 'Fecha de compra').next('input').clear().type('2026-02-01');
      cy.contains('label', 'Forma de pago').next('select').select('Transferencia');
      cy.contains('button', '+ Agregar producto').click();
      // el primer producto sugerido es uno de este proveedor
      cy.get('input[placeholder="Cant."]').clear().type('10');
      cy.get('input[aria-label="Costo unitario"]').clear().type('2500');
      cy.contains('Suma al stock: 250 kg').should('be.visible');
      cy.contains('Total: $25.000,00').should('be.visible');
      cy.contains('button', 'Registrar compra').click();
    });

    cy.wait('@fn_register-purchase').its('request.body').should('deep.include', {
      purchase_date: '2026-02-01',
      payment_method: 'transfer',
      items: [{ product_id: 'prod-1', quantity: 10, unit: 'bulk', unit_cost: 2500 }],
    });
    cy.contains('h2', 'Nueva compra').should('not.exist');
  });

  it('el monto pagado arranca con el total y lo que falta queda a cuenta del proveedor', () => {
    mockSupabase({
      profiles: [OWNER_PROFILE],
      suppliers: [{ ...baseSuppliers()[0], account_balance: 10000 }],
      products: baseProducts(),
      purchases: [],
    });
    mockFunction('register-purchase', { statusCode: 200, body: { data: { ok: true } } });
    cy.loginAs('/compras');

    cy.contains('button', 'Nueva compra').click();
    cy.get('form').within(() => {
      cy.contains('Cuenta corriente: le debés $10.000,00').should('be.visible');
      cy.contains('button', '+ Agregar producto').click();
      cy.get('input[placeholder="Cant."]').clear().type('10');
      cy.get('input[aria-label="Costo unitario"]').clear().type('2500');
      cy.contains('label', 'Monto pagado').next('input').should('have.value', '25000').clear().type('15000');
      cy.contains('Quedás debiendo $10.000,00 al proveedor').should('be.visible');
      cy.contains('Cuenta corriente después de la compra: le debés $20.000,00').should('be.visible');
      cy.contains('button', 'Registrar compra').click();
    });

    cy.wait('@fn_register-purchase').its('request.body.amount_paid').should('equal', 15000);
  });

  it('un producto con una sola unidad se envía en unidad minorista', () => {
    seedPurchases();
    mockFunction('register-purchase', { statusCode: 200, body: { data: { ok: true } } });
    cy.loginAs('/compras');

    cy.contains('button', 'Nueva compra').click();
    cy.get('form').within(() => {
      cy.contains('button', '+ Agregar producto').click();
      cy.contains('label', 'Productos').parent().find('select').first().select('Arena gruesa');
      cy.get('input[placeholder="Cant."]').clear().type('3');
      cy.contains('button', 'Registrar compra').click();
    });

    cy.wait('@fn_register-purchase')
      .its('request.body.items.0')
      .should('deep.include', { product_id: 'prod-2', quantity: 3, unit: 'retail' });
  });

  it('no deja registrar una compra sin productos', () => {
    seedPurchases();
    cy.loginAs('/compras');

    cy.contains('button', 'Nueva compra').click();
    cy.contains('button', 'Registrar compra').should('be.disabled');
  });

  it('muestra el error que devuelve la función y no cierra el formulario', () => {
    seedPurchases();
    mockFunction('register-purchase', { statusCode: 200, body: { error: 'La compra necesita al menos un producto con cantidad' } });
    cy.loginAs('/compras');

    cy.contains('button', 'Nueva compra').click();
    cy.get('form').within(() => {
      cy.contains('button', '+ Agregar producto').click();
      cy.contains('button', 'Registrar compra').click();
    });

    cy.contains('La compra necesita al menos un producto con cantidad').should('be.visible');
    cy.contains('h2', 'Nueva compra').should('exist');
  });

  it('abre el comprobante de una compra para imprimir o compartir', () => {
    seedPurchases([{ ...PURCHASE, amount_paid: 30000, account_balance_change: 20000 }]);
    cy.loginAs('/compras');

    cy.contains('tr', 'Factura A 0001-00001234').within(() => {
      cy.contains('button', 'Ver / Imprimir').click();
    });

    cy.get('.print-area').within(() => {
      cy.contains('h2', 'Comprobante de compra');
      cy.contains('10/1/2026');
      cy.contains('Loma Negra S.A.');
      cy.contains('CUIT: 30-12345678-9');
      cy.contains('tr', 'Cemento Loma Negra').should('contain', '20 bolsa').and('contain', '$2.500,00').and('contain', '$50.000,00');
      cy.contains('Total: $50.000,00');
      cy.contains('Pagado: $30.000,00 (Transferencia)');
      cy.contains('Saldo pendiente (a cuenta corriente): $20.000,00');
      cy.contains('Factura A 0001-00001234');
    });
    cy.contains('button', 'Imprimir').should('be.visible');

    cy.contains('button', '← Volver al listado').click();
    cy.contains('h1', 'Compras').should('be.visible');
  });

  it('después de registrar una compra abre su comprobante', () => {
    seedPurchases();
    mockFunction('register-purchase', {
      statusCode: 200,
      body: { success: true, purchase: { ...PURCHASE, notes: null, amount_paid: 50000, account_balance_change: 0 } },
    });
    cy.loginAs('/compras');

    cy.contains('button', 'Nueva compra').click();
    cy.get('form').within(() => {
      cy.contains('button', '+ Agregar producto').click();
      cy.contains('button', 'Registrar compra').click();
    });

    cy.get('.print-area').contains('h2', 'Comprobante de compra').should('be.visible');
  });

  it('permite registrar la compra entera a cuenta corriente del proveedor', () => {
    mockSupabase({
      profiles: [OWNER_PROFILE],
      suppliers: [{ ...baseSuppliers()[0], account_balance: 10000 }],
      products: baseProducts(),
      purchases: [],
    });
    mockFunction('register-purchase', { statusCode: 200, body: { data: { ok: true } } });
    cy.loginAs('/compras');

    cy.contains('button', 'Nueva compra').click();
    cy.get('form').within(() => {
      cy.contains('button', '+ Agregar producto').click();
      cy.get('input[placeholder="Cant."]').clear().type('10');
      cy.get('input[aria-label="Costo unitario"]').clear().type('2500');
      cy.contains('label', 'Forma de pago').next('select').select('Cuenta corriente (queda debiendo)');
      cy.contains('label', 'Monto pagado').should('not.exist');
      cy.contains('el total de la compra queda en la cuenta corriente del proveedor').should('be.visible');
      cy.contains('Quedás debiendo $25.000,00 al proveedor').should('be.visible');
      cy.contains('Cuenta corriente después de la compra: le debés $35.000,00').should('be.visible');
      cy.contains('button', 'Registrar compra').click();
    });

    cy.wait('@fn_register-purchase').its('request.body').should('deep.include', { payment_method: 'account', amount_paid: 0 });
  });

  it('en el listado una compra a cuenta corriente dice Cuenta corriente', () => {
    seedPurchases([{ ...PURCHASE, payment_method: 'account', amount_paid: 0, account_balance_change: 50000 }]);
    cy.loginAs('/compras');

    cy.contains('tr', 'Factura A 0001-00001234').should('contain', 'Cuenta corriente');
  });

  it('si la función responde con error 400 muestra el motivo real, no "Error de conexión"', () => {
    seedPurchases();
    mockFunction('register-purchase', {
      statusCode: 400,
      body: { error: 'null value in column "amount_paid" violates not-null constraint' },
    });
    cy.loginAs('/compras');

    cy.contains('button', 'Nueva compra').click();
    cy.get('form').within(() => {
      cy.contains('button', '+ Agregar producto').click();
      cy.contains('button', 'Registrar compra').click();
    });

    cy.contains('null value in column "amount_paid" violates not-null constraint').should('be.visible');
    cy.contains('Error de conexión').should('not.exist');
  });

  it('el comprobante se ve oscuro en modo oscuro, pero blanco al exportar a PDF', () => {
    seedPurchases([PURCHASE]);
    cy.loginAs('/compras');

    cy.document().then((doc) => doc.documentElement.classList.add('dark'));
    cy.contains('tr', 'Factura A 0001-00001234').within(() => {
      cy.contains('button', 'Ver / Imprimir').click();
    });

    // En pantalla, modo oscuro: fondo gris oscuro (no blanco).
    cy.contains('h2', 'Comprobante de compra')
      .closest('.rounded-xl')
      .should('not.have.css', 'background-color', 'rgb(255, 255, 255)');

    // Durante la exportación a PDF (lib/pdf.ts agrega .pdf-export) vuelve a ser papel blanco.
    cy.get('.print-area').then(($area) => $area[0].classList.add('pdf-export'));
    cy.contains('h2', 'Comprobante de compra').closest('.rounded-xl').should('have.css', 'background-color', 'rgb(255, 255, 255)');
  });
});
