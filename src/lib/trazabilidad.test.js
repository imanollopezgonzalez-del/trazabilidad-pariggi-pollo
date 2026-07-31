import { describe, it, expect } from 'vitest'
import { calcDiasMeses } from './trazabilidad.js'

describe('calcDiasMeses', () => {
  it('calcula 49 dias y 1.6 meses (fila real: Ñoquis de Pura Papa, planilla Cedisur)', () => {
    const { dias, meses } = calcDiasMeses(new Date(2025, 11, 19), new Date(2026, 1, 6))
    expect(dias).toBe(49)
    expect(meses).toBe(1.6)
  })

  it('calcula 51 dias y 1.7 meses (fila real: Ravioles de Ricota, planilla Cedisur)', () => {
    const { dias, meses } = calcDiasMeses(new Date(2025, 11, 19), new Date(2026, 1, 8))
    expect(dias).toBe(51)
    expect(meses).toBe(1.7)
  })

  it('calcula 608 dias y 20.3 meses (fila real: Sorrentinos de Jamon y Queso, planilla Cedisur)', () => {
    const { dias, meses } = calcDiasMeses(new Date(2024, 5, 12), new Date(2026, 1, 10))
    expect(dias).toBe(608)
    expect(meses).toBe(20.3)
  })

  it('devuelve dias negativos si el vencimiento es anterior a la entrega, para que la UI bloquee el guardado', () => {
    const { dias } = calcDiasMeses(new Date(2026, 0, 10), new Date(2026, 0, 1))
    expect(dias).toBeLessThan(0)
  })
})
