import { describe, it, expect } from 'vitest'
import { esAdmin, puedeCrear, tieneAcceso, tieneAlgunAcceso } from './acceso.js'

const admin = { rol: 'admin' }
const edicionTodas = { rol: 'edicion', acceso: { pariggi: { todas: true }, pollococido: { todas: true } } }
const lecturaGrandwich = { rol: 'lectura', acceso: { pollococido: { clientes: ['grandwich'] } } }

describe('esAdmin', () => {
  it('es true solo para rol admin', () => {
    expect(esAdmin(admin)).toBe(true)
    expect(esAdmin(edicionTodas)).toBe(false)
    expect(esAdmin(null)).toBe(false)
    expect(esAdmin(undefined)).toBe(false)
  })
})

describe('puedeCrear', () => {
  it('es true para admin y edicion, false para lectura', () => {
    expect(puedeCrear(admin)).toBe(true)
    expect(puedeCrear(edicionTodas)).toBe(true)
    expect(puedeCrear(lecturaGrandwich)).toBe(false)
    expect(puedeCrear(null)).toBe(false)
  })
})

describe('tieneAcceso', () => {
  it('admin tiene acceso a cualquier empresa/cliente', () => {
    expect(tieneAcceso(admin, 'pariggi', 'cedisur')).toBe(true)
    expect(tieneAcceso(admin, 'pollococido', 'lo-que-sea')).toBe(true)
  })

  it('todas:true da acceso a cualquier cliente de esa empresa', () => {
    expect(tieneAcceso(edicionTodas, 'pariggi', 'cedisur')).toBe(true)
    expect(tieneAcceso(edicionTodas, 'pollococido', 'grandwich')).toBe(true)
  })

  it('lista de clientes solo da acceso a esos ids', () => {
    expect(tieneAcceso(lecturaGrandwich, 'pollococido', 'grandwich')).toBe(true)
    expect(tieneAcceso(lecturaGrandwich, 'pollococido', 'otro-cliente')).toBe(false)
  })

  it('sin acceso configurado para esa empresa, deniega', () => {
    expect(tieneAcceso(lecturaGrandwich, 'pariggi', 'cedisur')).toBe(false)
  })

  it('usuario null/undefined deniega', () => {
    expect(tieneAcceso(null, 'pariggi', 'cedisur')).toBe(false)
    expect(tieneAcceso(undefined, 'pariggi', 'cedisur')).toBe(false)
  })
})

describe('tieneAlgunAcceso', () => {
  it('admin siempre true', () => {
    expect(tieneAlgunAcceso(admin, 'pariggi')).toBe(true)
  })

  it('true si hay cualquier entrada de acceso para esa empresa', () => {
    expect(tieneAlgunAcceso(lecturaGrandwich, 'pollococido')).toBe(true)
    expect(tieneAlgunAcceso(lecturaGrandwich, 'pariggi')).toBe(false)
  })

  it('usuario null/undefined deniega', () => {
    expect(tieneAlgunAcceso(null, 'pariggi')).toBe(false)
  })
})
