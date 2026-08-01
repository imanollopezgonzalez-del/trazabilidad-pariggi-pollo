import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import logoPariggi from '../assets/logo-pariggi.png'
import logoPollo from '../assets/logo-pollococido.png'

const LOGOS = { pariggi: logoPariggi, pollococido: logoPollo }

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

export async function exportPedidoPdf(empresa, pedido, permiteLote) {
  const doc = new jsPDF()
  const logoDataUrl = await loadImageAsDataUrl(LOGOS[empresa])
  doc.addImage(logoDataUrl, 'PNG', 14, 8, 28, 28)
  doc.setFontSize(14)
  doc.text(`Trazabilidad — ${pedido.cliente}`, 50, 22)
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(`Factura ${pedido.numeroFactura} · Generado el ${format(new Date(), 'dd/MM/yyyy')}`, 50, 29)

  const head = permiteLote
    ? ['Producto', 'Lote', 'Fecha entrega', 'Fecha vencimiento', 'Días', 'Meses']
    : ['Producto', 'Fecha entrega', 'Fecha vencimiento', 'Días', 'Meses']

  autoTable(doc, {
    startY: 44,
    head: [head],
    body: (pedido.items ?? []).map((item) => {
      const fila = [
        item.productoNombre,
        format(toDate(item.fechaEntrega), 'dd/MM/yyyy'),
        format(toDate(item.fechaVencimiento), 'dd/MM/yyyy'),
        String(item.dias),
        String(item.meses),
      ]
      if (permiteLote) fila.splice(1, 0, item.lote ?? '')
      return fila
    }),
    headStyles: { fillColor: [217, 119, 87] },
  })

  doc.save(`trazabilidad-${pedido.cliente.toLowerCase()}-factura-${pedido.numeroFactura}.pdf`)
}
