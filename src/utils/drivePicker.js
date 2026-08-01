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

function pedirTokenDeAcceso(clientId) {
  return loadGis().then(
    () =>
      new Promise((resolve, reject) => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPE,
          callback: (resp) => (resp.error ? reject(resp) : resolve(resp.access_token)),
        })
        tokenClient.requestAccessToken()
      })
  )
}

// Abre el selector de Google, limitado a la carpeta compartida del depósito.
// Devuelve los documentos elegidos como [{ id, nombre, url }] — sin subir
// ningún byte, el archivo ya vive en Drive, solo guardamos la referencia.
export async function elegirDocumentosDeDrive({ apiKey, clientId, folderId, multiselect = true }) {
  await loadGapiPicker()
  const accessToken = await pedirTokenDeAcceso(clientId)

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
