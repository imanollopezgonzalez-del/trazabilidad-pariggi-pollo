const SCOPE = 'https://www.googleapis.com/auth/drive.file'

let gapiPickerReady = null
let gisReady = null

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = resolve
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    document.head.appendChild(script)
  })
}

function loadGapiPicker() {
  if (!gapiPickerReady) {
    gapiPickerReady = loadScript('https://apis.google.com/js/api.js').then(
      () => new Promise((resolve) => window.gapi.load('picker', resolve))
    )
  }
  return gapiPickerReady
}

function loadGis() {
  if (!gisReady) {
    gisReady = loadScript('https://accounts.google.com/gsi/client')
  }
  return gisReady
}

// hint = email del usuario ya logueado en la app, para que Google use
// directamente esa cuenta en vez de mostrar el selector de todas las
// cuentas que tenga guardadas el navegador.
function pedirTokenDeAcceso(clientId, hint) {
  return loadGis().then(
    () =>
      new Promise((resolve, reject) => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPE,
          hint,
          callback: (resp) => (resp.error ? reject(resp) : resolve(resp.access_token)),
        })
        tokenClient.requestAccessToken({ hint })
      })
  )
}

// Abre el selector de Google, limitado a la carpeta compartida del depósito.
// Devuelve los documentos elegidos como [{ id, nombre, url }] — sin subir
// ningún byte, el archivo ya vive en Drive, solo guardamos la referencia.
export async function elegirDocumentosDeDrive({ apiKey, clientId, folderId, email, multiselect = true }) {
  await loadGapiPicker()
  const accessToken = await pedirTokenDeAcceso(clientId, email)

  return new Promise((resolve) => {
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
      .setParent(folderId)
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false)

    const builder = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setCallback((data) => {
        if (data.action === window.google.picker.Action.PICKED) {
          resolve(data.docs.map((d) => ({ id: d.id, nombre: d.name, url: d.url })))
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve([])
        }
      })

    if (multiselect) builder.enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
    builder.build().setVisible(true)
  })
}

// A diferencia de elegirDocumentosDeDrive (que lista archivos ya existentes
// en Drive), esta usa la vista "Subir" del Picker: abre el explorador de
// archivos del sistema operativo, sube el archivo elegido como hijo de
// folderId, y devuelve su referencia. Mismo token/scope (drive.file), sin
// subir bytes por fuera de la API de Drive — no hace falta Firebase Storage.
export async function subirDocumentoDesdeEquipo({ apiKey, clientId, folderId, email }) {
  await loadGapiPicker()
  const accessToken = await pedirTokenDeAcceso(clientId, email)

  return new Promise((resolve) => {
    const view = new window.google.picker.DocsUploadView().setParent(folderId)

    const builder = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setCallback((data) => {
        if (data.action === window.google.picker.Action.PICKED) {
          resolve(data.docs.map((d) => ({ id: d.id, nombre: d.name, url: d.url })))
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve([])
        }
      })

    builder.build().setVisible(true)
  })
}
