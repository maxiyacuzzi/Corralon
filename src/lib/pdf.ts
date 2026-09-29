import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';

/** Renderiza un elemento del DOM a un PDF de una o varias páginas A4 y lo devuelve como File. */
export async function elementToPdfFile(element: HTMLElement, fileName: string): Promise<File> {
  // .pdf-export desactiva el modo oscuro de los comprobantes (variante paper-dark en index.css):
  // el PDF compartido siempre sale en blanco, como papel.
  element.classList.add('pdf-export');
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
  } finally {
    element.classList.remove('pdf-export');
  }
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  const blob = pdf.output('blob');
  return new File([blob], fileName, { type: 'application/pdf' });
}
