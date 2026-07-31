# Trazabilidad Pariggi / Pollo Cocido

App interna de trazabilidad de entregas para Pastas Pariggi (cliente Cedisur) y Pollo Cocido (cliente Grandwich).

Ver el diseño completo en [`docs/superpowers/specs/2026-07-31-trazabilidad-design.md`](docs/superpowers/specs/2026-07-31-trazabilidad-design.md) y el plan de implementación en [`docs/superpowers/plans/2026-07-31-trazabilidad-implementation.md`](docs/superpowers/plans/2026-07-31-trazabilidad-implementation.md).

## Desarrollo local

```bash
npm install
npm run dev
```

Requiere un archivo `.env.local` con las variables `VITE_FIREBASE_*` (ver `.env.example`) — pedirle el archivo a Imanol, no se sube al repo.

## Tests

```bash
npm test
```

## Deploy

Automático a GitHub Pages en cada push a `main` (`.github/workflows/deploy.yml`). Los secrets `VITE_FIREBASE_*` deben estar configurados en el repo de GitHub (Settings → Secrets and variables → Actions).
