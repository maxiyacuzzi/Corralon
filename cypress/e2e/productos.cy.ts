import { mockSupabase } from '../support/mock-supabase';
import { OWNER_PROFILE, baseCategories, baseSuppliers, baseProducts } from '../support/fixtures';

function seedProducts() {
  mockSupabase({
    profiles: [OWNER_PROFILE],
    categories: baseCategories(),
    suppliers: baseSuppliers(),
    products: baseProducts(),
    stockpiles: [],
  });
}

describe('Productos', () => {
  it('lista los productos con su categoría, proveedor y estado de stock', () => {
    seedProducts();
    cy.loginAs('/productos');

    cy.contains('h1', 'Productos').should('be.visible');
    cy.contains('td', 'Cemento Loma Negra').should('be.visible');
    cy.contains('tr', 'Cemento Loma Negra').within(() => {
      cy.contains('Cementos y morteros');
      cy.contains('Loma Negra S.A.');
      cy.contains('Stock OK');
    });
    cy.contains('tr', 'Arena gruesa').within(() => {
      cy.contains('Stock OK');
    });
  });

  it('filtra productos por el buscador', () => {
    seedProducts();
    cy.loginAs('/productos');

    cy.get('input[placeholder*="Buscar por producto"]').type('arena');
    cy.contains('td', 'Arena gruesa').should('be.visible');
    cy.contains('td', 'Cemento Loma Negra').should('not.exist');
  });

  it('crea un producto nuevo', () => {
    seedProducts();
    cy.loginAs('/productos');

    cy.contains('button', 'Nuevo producto').click();
    cy.get('form').within(() => {
      cy.contains('label', 'Nombre').next('input').type('Hierro del 8');
      cy.contains('label', 'Unidad a granel').next('input').type('barra');
      cy.contains('label', 'Unidad minorista').next('input').type('unidad');
      cy.contains('label', /Factor de conversión/).next('input').clear().type('1');
      cy.contains('button', 'Guardar producto').click();
    });

    cy.wait('@supabaseRest');
    cy.contains('h2', 'Nuevo producto').should('not.exist');
    cy.contains('td', 'Hierro del 8').should('be.visible');
  });

  it('edita un producto existente sin tocar el stock actual', () => {
    seedProducts();
    cy.loginAs('/productos');

    cy.contains('tr', 'Cemento Loma Negra').within(() => {
      cy.contains('button', 'Editar').click();
    });

    cy.contains('h2', 'Editar producto').should('exist');
    cy.contains('label', 'Precio').next('input').clear().type('4200');
    cy.contains('button', 'Guardar cambios').click();

    cy.wait('@supabaseRest');
    cy.contains('h2', 'Editar producto').should('not.exist');
    cy.contains('tr', 'Cemento Loma Negra').within(() => {
      cy.contains('$4200.00');
    });
  });

  it('muestra un error si falla la creación de un producto', () => {
    seedProducts();
    cy.loginAs('/productos');

    cy.intercept('POST', '**/rest/v1/products*', { statusCode: 500, body: { message: 'unexpected error' } }).as(
      'insertProductFails'
    );

    cy.contains('button', 'Nuevo producto').click();
    cy.get('form').within(() => {
      cy.contains('label', 'Nombre').next('input').type('Hierro del 8');
      cy.contains('label', 'Unidad a granel').next('input').type('barra');
      cy.contains('label', 'Unidad minorista').next('input').type('unidad');
      cy.contains('button', 'Guardar producto').click();
    });

    cy.wait('@insertProductFails');
    cy.contains('No se pudo guardar el producto. Verificá tu conexión.').should('be.visible');
    cy.contains('h2', 'Nuevo producto').should('exist');
  });

  it('muestra un error si falla la edición de un producto', () => {
    seedProducts();
    cy.loginAs('/productos');

    cy.intercept('PATCH', '**/rest/v1/products*', { statusCode: 500, body: { message: 'unexpected error' } }).as(
      'updateProductFails'
    );

    cy.contains('tr', 'Cemento Loma Negra').within(() => {
      cy.contains('button', 'Editar').click();
    });
    cy.contains('label', 'Precio').next('input').clear().type('4200');
    cy.contains('button', 'Guardar cambios').click();

    cy.wait('@updateProductFails');
    cy.contains('No se pudo guardar el producto. Verificá tu conexión.').should('be.visible');
    cy.contains('h2', 'Editar producto').should('exist');
  });
});
