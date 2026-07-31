import { useEffect, useState } from 'react'
import { listEntregas } from '../services/entregas'
import EntregaFormPariggi from '../components/EntregaFormPariggi'
import HistorialTablaPariggi from '../components/HistorialTablaPariggi'
import { exportPariggiPdf } from '../utils/pdfExportPariggi'

export default function Pariggi() {
  const [entregas, setEntregas] = useState([])

  async function reload() {
    setEntregas(await listEntregas('pariggi'))
  }

  useEffect(() => { reload() }, [])

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold text-dark">Pastas Pariggi — Cedisur</h1>
      <EntregaFormPariggi onSaved={reload} />
      <div className="flex justify-between items-center">
        <h2 className="font-medium text-dark">Historial</h2>
        <button
          onClick={() => exportPariggiPdf(entregas)}
          className="text-sm bg-dark text-white rounded-lg px-4 py-2"
        >
          Exportar PDF
        </button>
      </div>
      <HistorialTablaPariggi entregas={entregas} />
    </div>
  )
}
