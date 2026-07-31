import { useEffect, useState } from 'react'
import { listEntregas } from '../services/entregas'
import EntregaFormPollo from '../components/EntregaFormPollo'
import HistorialTablaPollo from '../components/HistorialTablaPollo'

export default function PolloCocido() {
  const [entregas, setEntregas] = useState([])

  async function reload() {
    setEntregas(await listEntregas('pollococido'))
  }

  useEffect(() => { reload() }, [])

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold text-dark">Pollo Cocido — Grandwich</h1>
      <EntregaFormPollo onSaved={reload} />
      <h2 className="font-medium text-dark">Historial</h2>
      <HistorialTablaPollo entregas={entregas} />
    </div>
  )
}
