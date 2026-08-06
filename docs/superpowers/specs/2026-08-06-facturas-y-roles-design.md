# Facturas Grandwich + Roles y accesos por empresa/cliente

## Contexto

Hoy la app tiene un único nivel de permiso real: `admin: true` (puede borrar pedidos)
vs. cualquier otro email en `usuariosAutorizados` (puede hacer todo lo demás: cargar
pedidos, gestionar clientes/catálogo/usuarios). Se necesita:

1. Un botón para adjuntar la factura al pedido de Grandwich, subiendo un archivo desde
   la computadora (no eligiendo uno ya existente en Drive, como hacen hoy SENASA y
   Permiso de Tránsito).
2. Un sistema de roles (Admin / Edición / Lectura) con acceso configurable por
   empresa y por cliente, para dar de alta a un usuario de solo lectura (Hernán) sin
   exponerle capacidad de carga ni acceso a datos fuera de su alcance.

## 1. Factura Grandwich

- Nuevo botón "+ Agregar Factura" en `PedidoForm`, visible únicamente cuando
  `empresa === 'pollococido' && clienteId === 'grandwich'` (chequeo puntual en
  `Pedidos.jsx`, no un sistema genérico de permisos por cliente — no hace falta para
  un caso único).
- Mecanismo: `google.picker.DocsUploadView().setParentFolder(folderId)` en vez de
  `DocsView`. Esta vista del Picker abre el explorador de archivos del sistema
  operativo (no la lista de archivos ya existentes en Drive), sube el archivo elegido
  y lo deja como hijo de la carpeta indicada. Reutiliza la misma carga de gapi/GIS y
  el mismo token de acceso (`drive.file`) que ya usa `elegirDocumentosDeDrive` — no
  se agrega ninguna librería ni scope nuevo.
- La factura se guarda en una carpeta de Drive **separada** de la carpeta compartida
  de SENASA/Permiso: `1XXvWllCM04LBQIlPutQwTnem1ZFfa2QW`, ya creada y compartida por
  Imanol. Nueva env var: `VITE_GOOGLE_DRIVE_FOLDER_ID_FACTURAS_GRANDWICH`.
- `documentoFactura` se guarda en el pedido con la misma forma que los otros dos
  (`{ id, nombre, url }`), agregado a `crearPedido` en `services/pedidos.js`.
- Reordeno los 3 selectores de documento (SENASA, Permiso de Tránsito, Factura) en
  columna, agrupados bajo un encabezado "Documentos", en vez de la grilla de 2
  columnas actual — mismo cambio de layout en `PedidoForm` (los botones) y en
  `HistorialPedidos` (los links de descarga).

## 2. Roles y accesos por empresa/cliente

### Modelo de datos

`usuariosAutorizados/{email}`:

```
{
  rol: 'admin' | 'edicion' | 'lectura',
  acceso: {
    pariggi?: { todas: true } | { clientes: string[] },      // ids en minúscula, como en clientes/{empresa}/items/{id}
    pollococido?: { todas: true } | { clientes: string[] },
  },
  agregadoPor, agregadoEn  // como hoy
}
```

`rol: 'admin'` implica acceso total; el campo `acceso` se ignora para admins.
Reemplaza al `admin: true` actual (se migra el doc existente).

Asignación inicial:

| Email | rol | acceso |
|---|---|---|
| imanollopezgonzalez@gmail.com | admin | (todo) |
| ivan.larez@pollococido.com.ar | edicion | `{ pariggi: {todas:true}, pollococido: {todas:true} }` |
| hernan.o@pollococido.com.ar | lectura | `{ pollococido: { clientes: ['grandwich'] } }` |

Permisos por rol (dentro de su `acceso`):

- **admin**: todo — crear/ver/borrar pedidos, gestionar clientes, catálogo de
  productos y usuarios, en cualquier empresa/cliente.
- **edicion**: crear y ver pedidos (con adjuntos). No gestiona clientes, catálogo ni
  usuarios — esas secciones de Ajustes quedan ocultas y bloqueadas por reglas.
- **lectura**: solo ver el historial de pedidos y abrir/descargar sus documentos
  adjuntos. No ve el formulario de carga ni la página de Ajustes.

`pedidos` gana un campo `clienteId` (además del `cliente` con el nombre para
mostrar), tomado del param de ruta al crear el pedido, para que las reglas puedan
comparar contra `acceso[empresa].clientes` sin normalizar mayúsculas/minúsculas.

### Reglas de Firestore

```
function usuario() {
  return get(/databases/$(database)/documents/usuariosAutorizados/$(request.auth.token.email)).data;
}
function isAuthorized() {
  return request.auth != null &&
    exists(/databases/$(database)/documents/usuariosAutorizados/$(request.auth.token.email));
}
function isAdmin() {
  return isAuthorized() && usuario().rol == 'admin';
}
function puedeCrear() {
  return isAuthorized() && usuario().rol in ['admin', 'edicion'];
}
function tieneAcceso(empresa, clienteId) {
  let u = usuario();
  return u.rol == 'admin' ||
    (('acceso' in u) && (empresa in u.acceso) &&
      (u.acceso[empresa].todas == true ||
        (('clientes' in u.acceso[empresa]) && clienteId in u.acceso[empresa].clientes)));
}

match /usuariosAutorizados/{email} {
  allow read: if isAuthorized();
  allow write: if isAdmin();
}
match /productos/{empresa}/items/{productoId} {
  allow read: if isAuthorized();
  allow write: if isAdmin();
}
match /clientes/{empresa}/items/{clienteId} {
  allow read: if isAuthorized();
  allow write: if isAdmin();
}
match /pedidos/{pedidoId} {
  allow read: if isAuthorized() && tieneAcceso(resource.data.empresa, resource.data.clienteId);
  allow create: if puedeCrear() &&
    tieneAcceso(request.resource.data.empresa, request.resource.data.clienteId) &&
    request.resource.data.creadoPor == request.auth.token.email;
  allow delete: if isAdmin();
}
```

Esto es un endurecimiento respecto a hoy: actualmente cualquier usuario autorizado
(no solo admin) puede escribir en `usuariosAutorizados`, `productos` y `clientes`.
Pasa a ser exclusivo de admin, alineado con la decisión de que Edición "solo carga y
ve pedidos".

### Cambios de UI

- `AuthContext`: además de `user`/`status`, expone `rol`, `acceso`, `isAdmin`
  (`rol === 'admin'`), `puedeCrear` (`rol` admin/edicion) y un helper
  `tieneAcceso(empresa, clienteId)`.
- `Empresas.jsx`: solo muestra el tile de una empresa si el usuario tiene algún
  acceso en ella (admin, o `acceso[empresa]` existe).
- `ClienteSelector.jsx`: filtra la lista de clientes a los permitidos (`todas` o el
  id específico), salvo admin que ve todos.
- `Pedidos.jsx`: si no hay acceso a esa empresa/cliente (navegación directa por URL),
  muestra "No autorizado" en vez de la página. Si `puedeCrear` es false (rol
  lectura), no renderiza `PedidoForm`, solo `HistorialPedidos`.
- `Layout.jsx`: el link "Ajustes" solo se muestra si `isAdmin`.
- `Ajustes.jsx`: las secciones de Clientes y Catálogo de productos quedan igual que
  hoy pero la página entera pasa a ser admin-only (ya cubierto por ocultar el link,
  más la regla de Firestore como defensa real). La sección "Usuarios autorizados"
  suma un selector de rol y, si no es admin, checkboxes de empresa/cliente
  (`todas` o selección puntual) para definir `acceso`.

## Fuera de alcance

- No se construye un sistema genérico de permisos por cliente para el botón de
  Factura — queda hardcodeado a Grandwich, como se pidió.
- No se agrega edición de `acceso`/`rol` para usuarios ya existentes más allá del
  formulario de alta (si hace falta cambiar a alguien después, se re-agrega con los
  valores nuevos — mismo patrón que hoy con `admin`).
