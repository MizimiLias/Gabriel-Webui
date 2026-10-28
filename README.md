# Gabriel Web UI

React 19 + TypeScript + Vite frontend for the Gabriel Agent backend. The
interface provides streaming chat, persistent conversation history, generated
session titles, inline renaming, persona management and selection, local
search, responsive navigation, and light/dark/system themes with Chinese and
English copy.

## Requirements

- Node.js 24+
- pnpm 12+
- The Gabriel backend running at `http://127.0.0.1:8086`

## Development

```bash
pnpm install
pnpm dev
```

Vite proxies `/api` to `http://127.0.0.1:8086` by default. Override the proxy
target when the backend runs elsewhere:

```bash
GABRIEL_API_TARGET=http://127.0.0.1:8087 pnpm dev
```

For a separately hosted frontend, set `VITE_API_BASE_URL` at build time. The
recommended production setup serves the built frontend and API from the same
origin through a reverse proxy, so no CORS configuration is required.

## Quality checks

```bash
pnpm lint
pnpm test
pnpm build
```

## Design notes

- Warm ivory canvas, pale ice-blue navigation, gilded actions, and deep navy
  dark surfaces.
- The replaceable Gabriel avatar lives at
  `public/brand/gabriel-avatar.jpeg`.
- Theme and language preferences are stored in `localStorage`.
- Session search runs locally over the complete session list returned by the
  backend.
