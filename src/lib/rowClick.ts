import type { KeyboardEvent, MouseEvent } from 'react';

/**
 * Props para una fila de tabla que se abre para editar al hacerle click
 * (convención de toda la app: no hay botón "Editar", se clickea la fila).
 * También responde a Enter cuando la fila tiene el foco.
 */
export function editableRowProps(onEdit: () => void) {
  // El formulario de edición se muestra arriba de la tabla: se sube hasta él.
  const open = () => {
    onEdit();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return {
    onClick: open,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      // Solo si el foco está en la fila misma, no en un botón o link adentro.
      if (event.key === 'Enter' && event.target === event.currentTarget) open();
    },
    tabIndex: 0,
    title: 'Click para editar',
    className: 'cursor-pointer hover:bg-orange-500/5 focus:outline-none focus-visible:bg-orange-500/10',
  };
}

/** Para celdas con botones o links propios dentro de una fila editable: que su click no abra la edición. */
export function stopRowClick(event: MouseEvent) {
  event.stopPropagation();
}
