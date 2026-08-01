import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import logoPariggi from '../assets/logo-pariggi.png'

function loadImageAsDataUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      canvas.getContext('2d').drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = src
  })
}

function toDate(value) {
  return value?.toDate ? value.toDate() : value
}

export async function exportPariggiPdf(pedidos, clienteNombre) {
  const filas = pedidos.flatMap((p) =>
    (p.items ?? []).map((item) => ({ ...item, numeroFactura: p.numeroFactura }))
  )

  const doc = new jsPDF()
  const logoDataUrl = await loadImageAsDataUrl(logoPariggi)
  doc.addImage(logoDataUrl, 'PNG', 14, 8, 28, 28)
  doc.setFontSize(14)
  doc.text(`Trazabilidad — ${clienteNombre}`, 50, 22)
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(`Generado el ${format(new Date(), 'dd/MM/yyyy')}`, 50, 29)

  autoTable(doc, {
    startY: 44,
    head: [['Factura', 'Producto', 'Fecha entrega', 'Fecha vencimiento', 'Días', 'Meses']],
    body: filas.map((item) => [
      item.numeroFactura,
      item.productoNombre,
      format(toDate(item.fechaEntrega), 'dd/MM/yyyy'),
      format(toDate(item.fechaVencimiento), 'dd/MM/yyyy'),
      String(item.dias),
      String(item.meses),
    ]),
    headStyles: { fillColor: [217, 119, 87] },
  })

  doc.save(`trazabilidad-${clienteNombre.toLowerCase()}-${format(new Date(), 'yyyyMMdd')}.pdf`)
}
