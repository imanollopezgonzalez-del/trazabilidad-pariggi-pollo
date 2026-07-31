# Trazabilidad Pariggi / Pollo Cocido — Design

## Contexto

Imanol tiene dos empresas (Pastas Pariggi, cliente Cedisur; Pollo Cocido, cliente Grandwich), cada una con un protocolo de trazabilidad distinto que hoy vive en una planilla Excel manual. Necesita una app web chica, rápida y eficiente para que el personal de depósito cargue esta información y quede con historial, en vez de editar un Excel a mano. La app debe estar accesible por internet (no solo en una PC del depósito).

Fuente real de referencia: `Fechas Cedisur.png` (planilla que hoy le pasan a Cedisur — columnas Producto / Fecha entrega Surfrigo / Fecha de vencimiento / Días / Meses).

No confundir con [proyecto Sistemas Pollo-Pariggi (ERP)] ni con el [tablero de tareas] — son sistemas separados, este es nuevo y aislado a propósito para no arriesgar nada que ya está en uso diario.

## Alcance

Cubre hoy 2 empresas × 1 cliente cada una (Pariggi→Cedisur, Pollo Cocido→Grandwich), pero el modelo de datos deja lugar a que cada empresa tenga más de un cliente en el futuro (campo `cliente` abierto, no hardcodeado a una sola opción por empresa).

Fuera de alcance para esta primera versión: integración con el ERP grande, roles diferenciados (todos los usuarios autorizados tienen el mismo nivel de acceso), notificaciones, exportación de Pollo Cocido a PDF (ese flujo usa el permiso de tránsito escaneado como documento, no genera uno nuevo).

## Approach

App standalone: **React + Vite + Firebase (Auth + Firestore + Storage) + GitHub Pages**, mismo patrón ya probado en el tablero de tareas (`imanollopezgonzalez-del/task-tracker`), pero con **Firebase project propio** y **repo propio** (`trazabilidad-pariggi-pollo`) — sin tocar ni compartir estado con el tablero de tareas ni con el ERP.

Se descartó integrarlo al tablero de tareas (mezclaría trazabilidad alimentaria con gestión de tareas, y arriesgaría un sistema que el equipo ya usa a diario) y al ERP grande (todavía en desarrollo activo, no apto para colgar algo crítico de trazabilidad).

## Autenticación

Google Sign-In (Firebase Auth, provider Google) restringido por whitelist de emails autorizados. Whitelist inicial:
- `imanollopezgonzalez@gmail.com`
- `ivan.larez@pollococido.com.ar`

Editable después desde una pantalla de Ajustes (colección `usuariosAutorizados` en Firestore, solo emails ya en la whitelist pueden agregar otros — ver reglas de seguridad abajo). Todos los usuarios autorizados tienen el mismo nivel de acceso (cargar + ver historial completo de ambas empresas) — no hay rol admin/operador en esta versión.

La restricción se aplica en dos capas, no solo en el frontend:
1. Frontend: tras el login con Google, se chequea el email contra `usuariosAutorizados` antes de mostrar la app; si no está, se cierra la sesión y se muestra "acceso no autorizado".
2. **Firestore Security Rules** y **Storage Security Rules**: todas las lecturas/escrituras exigen que exista el documento `usuariosAutorizados/$(request.auth.token.email)`. Firestore rules lo valida directo (`exists(/databases/$(database)/documents/usuariosAutorizados/$(request.auth.token.email))`); Storage rules usa `firestore.exists(...)` sobre esa misma colección para no duplicar la whitelist en dos lugares. Esto es lo que realmente protege los datos: alguien con la URL pero sin estar en la whitelist no puede leer ni escribir nada aunque inspeccione el frontend.

Antes de dar el proyecto por terminado se corre el skill `security-review` sobre las reglas de Firestore/Storage y la config de Auth.

## Modelo de datos (Firestore)

```
productos/{empresa}/items/{productoId}
  codigo: string
  nombre: string
  activo: boolean

entregas/{id}
  empresa: "pariggi" | "pollococido"
  cliente: string              // "Cedisur" | "Grandwich" hoy, abierto a futuro
  productoId: string
  productoCodigo: string       // copiado al momento de guardar, para que el historial no cambie si el catálogo se edita después
  productoNombre: string
  lote: string | null          // solo Pollo Cocido
  fechaEntrega: timestamp
  fechaVencimiento: timestamp
  dias: number                 // calculado
  meses: number                // calculado, 1 decimal
  adjuntoUrl: string | null    // solo Pollo Cocido, URL de Storage al permiso de tránsito escaneado
  adjuntoNombre: string | null
  creadoPor: string            // email del usuario
  creadoEn: timestamp

usuariosAutorizados/{email}
  agregadoPor: string
  agregadoEn: timestamp
```

**Fórmula de días/meses (verificada contra la planilla real de Cedisur):**
- `dias = fechaVencimiento − fechaEntrega` (diferencia en días calendario)
- `meses = round(dias / 30, 1)`

Verificación con las 3 filas reales de `Fechas Cedisur.png`: 49→1.6, 51→1.7, 608→20.3. Coincide exacto.

## Catálogos iniciales

**Pastas Pariggi** (código — nombre):
10201 Cables de Teléfono al Huevo · 6010 Bucatini · 10202 Cuerdas de guitarra al huevo · 20301 Cables de Teléfono Integrales · 30101 Ñoquis de Pura Papa · 50201 Ravioles de Ricota Sicilianos · 60202 Raviolones de Espinaca y Provolone · 70205 Sorrentinos de Jamón y Mozzarella · 70206 Sorrentinos de Calabaza de Ferrara · 101070207 Foglia de Lasagna · 101070208 Ñoquis a la Romana con Parmesano · 101030103 Ñoquis de Espinaca · 1030102 Ñoquis de Calabaza · 101010203 Tagliatelle de Espinaca · 101010204 Puntallete 1,5 kg · 101010210 Puntallete 1 kg

**Pollo Cocido** (código — nombre):
200324 Milanesa de Pollo · 200222 Pechuga 90/110 grs · 200223 Pechuga 150/180 grs · 200224 Trocitos de 20x20x20 · 200305 Bifecitos Neo · 200243 Fingers de Pollo

Ambos catálogos son editables después desde Ajustes (alta/baja de productos, sin borrar entregas históricas ya asociadas a un producto dado de baja — por eso `entregas` copia código/nombre al momento de guardar).

## Flujo — Pastas Pariggi (Cedisur)

1. Operador entra a "Pariggi" → formulario: producto (desplegable "código — nombre"), fecha de entrega, fecha de vencimiento.
2. Días/meses se calculan y muestran en vivo apenas están las dos fechas.
3. "Guardar" agrega el registro a `entregas` y aparece como nueva fila al tope del historial.
4. Historial: tabla con las mismas columnas de la planilla de Cedisur (Producto / Fecha entrega / Fecha vencimiento / Días / Meses), ordenada por fecha de entrega descendente, con buscador simple por producto.
5. "Exportar PDF": selector de rango de fechas (default: todo el historial) → genera un PDF con el isologo de Pariggi (reutilizado del repo `pariggi-web`, `assets/isologo-pariggi-blanco.png` o el logo completo según fondo) arriba y la tabla abajo, mismo formato que la planilla original.

## Flujo — Pollo Cocido (Grandwich)

1. Operador entra a "Pollo Cocido" → formulario: producto (desplegable), número de lote (texto libre), fecha de entrega, fecha de vencimiento.
2. Días/meses en vivo, igual que Pariggi.
3. Campo "Adjuntar permiso de tránsito": botón que abre el explorador de archivos del sistema operativo (`<input type="file" accept="application/pdf,image/*">`) — el operador navega hasta la carpeta de su escritorio donde ya dejó el escaneo y lo selecciona. El navegador no puede pre-abrir esa carpeta específica por restricciones de seguridad del propio sistema operativo/navegador, pero si el operador siempre escanea al mismo lugar, es una carpeta reciente en el selector nativo.
4. "Guardar": sube el archivo a Storage (`permisos/{empresa}/{entregaId}/{nombreArchivo}`) y crea el registro en `entregas` con la URL.
5. Historial: tabla con Producto / Lote / Fecha entrega / Fecha vencimiento / Días / Meses / ícono para ver o descargar el adjunto.

## Manejo de errores / casos borde

- Fecha de vencimiento anterior a la de entrega: bloquear guardado, mensaje claro ("la fecha de vencimiento no puede ser anterior a la de entrega").
- Guardar sin producto seleccionado o sin las dos fechas: botón "Guardar" deshabilitado hasta que el formulario sea válido.
- Adjunto de Pollo Cocido: opcional al guardar (para no bloquear si el operador todavía no escaneó), pero la fila del historial muestra visualmente "sin adjunto" para que se note y se pueda completar después editando la entrega.
- Archivo adjunto: tope de tamaño razonable (ej. 15 MB) con mensaje de error si se excede, para evitar escaneos gigantes sin comprimir.
- Login con un email fuera de la whitelist: mensaje "tu cuenta no tiene acceso a esta herramienta, pedile a Imanol que te agregue" y cierre de sesión automático.

## Deploy

- Firebase project nuevo (Auth + Firestore + Storage).
- GitHub Actions build (`npm run build`) → deploy a GitHub Pages en cada push a `main`, igual que `task-tracker` (variables de entorno de Firebase como GitHub Secrets).
- Antes de cerrar el proyecto: correr el skill `security-review` sobre reglas de Firestore/Storage y configuración de Auth.

## Testing

- Verificación manual del cálculo de días/meses contra las 3 filas reales de `Fechas Cedisur.png` (ya validado arriba en el diseño).
- Prueba end-to-end manual con Playwright o en navegador real: login con email autorizado y con uno no autorizado (debe rechazar), carga de una entrega Pariggi completa, carga de una entrega Pollo Cocido con adjunto, exportación de PDF, verificación visual del PDF contra el formato de la planilla original.
