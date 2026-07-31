import { format } from 'date-fns'

function toDate(value) {
  return value?.toDate ? value.toDate() : value
}

export default function HistorialTablaPollo({ entregas }) {
  return (
    <div className="bg-white rounded-xl shadow overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-500">
          <tr>
            <th className="px-4 py-2">Producto</th>
            <th className="px-4 py-2">Lote</th>
            <th className="px-4 py-2">Fecha entrega</th>
            <th className="px-4 py-2">Fecha vencimiento</th>
            <th className="px-4 py-2">Días</th>
            <th className="px-4 py-2">Meses</th>
            <th className="px-4 py-2">Adjunto</th>
          </tr>
        </thead>
        <tbody>
          {entregas.map((e) => (
            <tr key={e.id} className="border-t">
              <td className="px-4 py-2">{e.productoNombre}</td>
              <td className="px-4 py-2">{e.lote}</td>
              <td className="px-4 py-2">{format(toDate(e.fechaEntrega), 'dd/MM/yyyy')}</td>
              <td className="px-4 py-2">{format(toDate(e.fechaVencimiento), 'dd/MM/yyyy')}</td>
              <td className="px-4 py-2">{e.dias}</td>
              <td className="px-4 py-2">{e.meses}</td>
              <td className="px-4 py-2">
                {e.adjuntoUrl ? (
                  <a href={e.adjuntoUrl} target="_blank" rel="noreferrer" className="text-pollo hover:underline">Ver</a>
                ) : (
                  <span className="text-gray-400">Sin adjunto</span>
                )}
              </td>
            </tr>
          ))}
          {entregas.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Sin registros todavía.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
