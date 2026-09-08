import { mockSupabase } from '../support/mock-supabase';
import { OWNER_PROFILE, baseCategories } from '../support/fixtures';

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

    cy.wait('@supabaseRest').its('request.body').should('deep.include', { parent_id: 'cat-1' });
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
});
