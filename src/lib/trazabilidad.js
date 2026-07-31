const MS_PER_DAY = 1000 * 60 * 60 * 24

export function calcDiasMeses(fechaEntrega, fechaVencimiento) {
  const dias = Math.round((fechaVencimiento.getTime() - fechaEntrega.getTime()) / MS_PER_DAY)
  const meses = Math.round((dias / 30) * 10) / 10
  return { dias, meses }
}
