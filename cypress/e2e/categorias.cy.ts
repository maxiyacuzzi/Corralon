import { mockSupabase } from '../support/mock-supabase';
import { OWNER_PROFILE, baseCategories, baseProducts } from '../support/fixtures';

describe('Categorías', () => {
  it('lista las categorías existentes', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], categories: baseCategories() });
    cy.loginAs('/categorias');

    cy.contains('h1', 'Categorías').should('be.visible');
    cy.contains('Cementos y morteros').should('be.visible');
    cy.contains('Áridos').should('be.visible');
  });

  it('muestra el estado vacío cuando no hay categorías', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], categories: [] });
    cy.loginAs('/categorias');

    cy.contains('No hay categorías cargadas todavía.').should('be.visible');
  });

  it('crea una categoría nueva y la refleja en el listado', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], categories: baseCategories() });
    cy.loginAs('/categorias');

    cy.contains('button', 'Nueva categoría').click();
    cy.get('form').within(() => {
      cy.get('input').type('Herrajes');
      cy.contains('button', 'Guardar categoría').click();
    });

    cy.wait('@supabaseRest');
    cy.contains('h2', 'Nueva categoría').should('not.exist');
    cy.contains('Herrajes').should('be.visible');
  });

  it('muestra un error si falla el guardado', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], categories: baseCategories() });
    cy.loginAs('/categorias');

    cy.intercept('POST', '**/rest/v1/categories*', {
      statusCode: 409,
      body: { message: 'duplicate key value violates unique constraint' },
    }).as('insertCategoryFails');

    cy.contains('button', 'Nueva categoría').click();
    cy.get('form').within(() => {
      cy.get('input').type('Cementos y morteros');
      cy.contains('button', 'Guardar categoría').click();
    });

    cy.wait('@insertCategoryFails');
    cy.contains('Ya existe una categoría con ese nombre.').should('be.visible');
  });

  it('crea una subcategoría bajo una categoría existente', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], categories: baseCategories() });
    cy.intercept('POST', '**/rest/v1/categories*').as('insertCategory');
    cy.loginAs('/categorias');

    cy.contains('span', 'Cementos y morteros')
      .parents('div')
      .first()
      .within(() => {
        cy.contains('button', 'Subcategoría').click();
      });

    cy.contains('h2', 'Nueva subcategoría').should('be.visible');
    cy.contains('label', 'Nombre de la subcategoría de "Cementos y morteros"').should('be.visible');
    cy.get('form').within(() => {
      cy.get('input').type('Cemento');
      cy.contains('button', 'Guardar subcategoría').click();
    });

    cy.wait('@insertCategory').its('request.body').should('deep.include', { parent_id: 'cat-1' });
    cy.contains('h2', 'Nueva subcategoría').should('not.exist');
    cy.contains('↳ Cemento').should('be.visible');
  });

  it('muestra las subcategorías anidadas bajo su categoría padre', () => {
    mockSupabase({
      profiles: [OWNER_PROFILE],
      categories: [...baseCategories(), { id: 'cat-3', name: 'Cemento', parent_id: 'cat-1', created_at: '2026-01-01T00:00:00.000Z' }],
    });
    cy.loginAs('/categorias');

    cy.contains('↳ Cemento').should('be.visible');
  });

  it('edita el nombre de una categoría', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], categories: baseCategories() });
    cy.intercept('PATCH', '**/rest/v1/categories*').as('updateCategory');
    cy.loginAs('/categorias');

    cy.contains('span', 'Áridos').click();
    cy.contains('button', 'Editar').should('not.exist');

    cy.contains('h2', 'Editar categoría').should('be.visible');
    cy.get('form').within(() => {
      cy.get('input').should('have.value', 'Áridos').clear().type('Áridos y piedras');
      cy.contains('button', 'Guardar cambios').click();
    });

    cy.wait('@updateCategory').its('request.body').should('deep.include', { name: 'Áridos y piedras', parent_id: null });
    cy.contains('h2', 'Editar categoría').should('not.exist');
    cy.contains('Áridos y piedras').should('be.visible');
  });

  it('permite mover una subcategoría a otra categoría padre', () => {
    mockSupabase({
      profiles: [OWNER_PROFILE],
      categories: [...baseCategories(), { id: 'cat-3', name: 'Cemento', parent_id: 'cat-1', created_at: '2026-01-01T00:00:00.000Z' }],
    });
    cy.intercept('PATCH', '**/rest/v1/categories*').as('updateCategory');
    cy.loginAs('/categorias');

    cy.contains('span', '↳ Cemento').click();
    cy.get('form').within(() => {
      cy.contains('label', 'Categoría padre').next('select').select('Áridos');
      cy.contains('button', 'Guardar cambios').click();
    });

    cy.wait('@updateCategory').its('request.body').should('deep.include', { name: 'Cemento', parent_id: 'cat-2' });
  });

  it('pide confirmación y elimina una categoría, avisando subcategorías y productos afectados', () => {
    mockSupabase({
      profiles: [OWNER_PROFILE],
      categories: [...baseCategories(), { id: 'cat-3', name: 'Cemento', parent_id: 'cat-1', created_at: '2026-01-01T00:00:00.000Z' }],
      products: baseProducts(),
    });
    cy.intercept('DELETE', '**/rest/v1/categories*').as('deleteCategory');
    cy.loginAs('/categorias');

    cy.contains('span', 'Cementos y morteros').parent().within(() => {
      cy.contains('button', 'Eliminar').click();
    });

    cy.contains('¿Eliminar "Cementos y morteros"?')
      .should('contain', 'También se elimina su subcategoría.')
      .and('contain', '1 producto queda sin categoría.');
    cy.contains('button', 'Sí, eliminar').click();

    cy.wait('@deleteCategory').its('request.url').should('include', 'id=eq.cat-1');
    cy.contains('span', 'Cementos y morteros').should('not.exist');
  });

  it('cancelar la eliminación no borra nada', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], categories: baseCategories() });
    cy.loginAs('/categorias');

    cy.contains('span', 'Áridos').parent().within(() => {
      cy.contains('button', 'Eliminar').click();
    });
    cy.contains('¿Eliminar "Áridos"?').should('be.visible');
    cy.contains('button', 'Cancelar').click();

    cy.contains('¿Eliminar "Áridos"?').should('not.exist');
    cy.contains('span', 'Áridos').should('be.visible');
  });

  it('los botones de la fila (Subcategoría, Eliminar) no abren la edición', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], categories: baseCategories() });
    cy.loginAs('/categorias');

    cy.contains('span', 'Áridos').parent().within(() => {
      cy.contains('button', 'Eliminar').click();
    });
    cy.contains('¿Eliminar "Áridos"?').click();
    cy.contains('h2', 'Editar categoría').should('not.exist');
  });
});
