import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import logoPariggi from '../assets/logo-pariggi.png'

// El logo fuente es blanco sobre transparente (mismo asset que usa el sitio
// con filter:brightness(0) en CSS). Acá se recolorea a oscuro sobre canvas
// para que sea visible en un PDF con fondo blanco.
function loadLogoAsDarkDataUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      ctx.globalCompositeOperation = 'source-in'
      ctx.fillStyle = '#1C1917'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = src
  })
}

function toDate(value) {
  return value?.toDate ? value.toDate() : value
}

export async function exportPariggiPdf(entregas, { desde, hasta } = {}) {
  const filtradas = entregas.filter((e) => {
    const fecha = toDate(e.fechaEntrega)
    if (desde && fecha < desde) return false
    if (hasta && fecha > hasta) return false
    return true
  })

  const doc = new jsPDF()
  const logoDataUrl = await loadLogoAsDarkDataUrl(logoPariggi)
  doc.addImage(logoDataUrl, 'PNG', 14, 8, 28, 34)
  doc.setFontSize(14)
  doc.text('Trazabilidad — Cedisur', 50, 24)
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(`Generado el ${format(new Date(), 'dd/MM/yyyy')}`, 50, 31)

  autoTable(doc, {
    startY: 48,
    head: [['Producto', 'Fecha entrega', 'Fecha vencimiento', 'Días', 'Meses']],
    body: filtradas.map((e) => [
      e.productoNombre,
      format(toDate(e.fechaEntrega), 'dd/MM/yyyy'),
      format(toDate(e.fechaVencimiento), 'dd/MM/yyyy'),
      String(e.dias),
      String(e.meses),
    ]),
    headStyles: { fillColor: [217, 119, 87] },
  })

  doc.save(`trazabilidad-cedisur-${format(new Date(), 'yyyyMMdd')}.pdf`)
}
