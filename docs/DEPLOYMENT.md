# Deploy the complete desktop application

The complete app needs a Node process and Python. The hosted Site preview serves static files and Python-compiled sample cases; it is not the full Python backend.

## Local first run

Use Node.js 22+ and Python 3.10+. No `npm install` or Python package installation is required for the application runtime.

```bash
npm run build
npm start
```

Open http://127.0.0.1:3000. The local default binds to loopback. If Python is installed under another executable name, set `PYTHON_EXECUTABLE` to its absolute path. Optional notebooks and the complete development suite use packages from `requirements.txt`.

## Container deployment

1. Extract the source ZIP and open its `artha-equity` directory.
2. Copy `.env.example` to `.env` and choose a private, strong `APP_AUTH_PASSWORD`. Keep this file out of Git. The default username is `research`.
3. Run `docker compose up --build -d`.
4. Open http://localhost:3000 and authenticate. Check `/api/health` for status.
5. For an internet-facing deployment, put the container behind your host's HTTPS reverse proxy and keep the origin port restricted to that proxy. HTTP Basic authentication must travel over HTTPS.

The container runs as the unprivileged `node` user. Compose mounts the `artha-data` volume for SQLite history. Keep this volume when upgrading. Back it up with the service stopped, or use SQLite's online backup facility. `docker compose down` preserves the volume; adding `--volumes` deletes it.

Production startup requires `APP_AUTH_PASSWORD` and validates each registered company's default Python model before listening. Health is unauthenticated and reveals status/capability, not credentials or financial records. Other UI/API routes require authentication when a password is configured. API requests have body limits, rate limits and same-origin checks. This is a shared-password single-workspace deployment, not a multi-tenant account system.

## Environment variables

| Variable | Purpose |
|---|---|
| `APP_AUTH_USER` | HTTP Basic username; default `research` |
| `APP_AUTH_PASSWORD` | Required for production; choose locally |
| `NODE_ENV` | Set to `production` on the server |
| `HOST`, `PORT` | Bind address and port; Compose uses `0.0.0.0:3000` |
| `PYTHON_EXECUTABLE` | Optional absolute Python executable path |
| `LLM_API_KEY`, `LLM_MODEL` | Optional server-side provider configuration |
| `LLM_API_URL` | HTTPS chat-completions endpoint |

For a native process, copy `.env.example` to `.env`, configure values and run `node --env-file=.env backend/server.mjs`. Add your host's process supervisor, HTTPS termination and persistent disk. The server does not load `.env` implicitly; Compose does read it for interpolation.

## Verify a deployment

- `/api/health` returns JSON identifying Python as the calculation authority.
- Unauthenticated access to the UI/API returns 401 when a password is configured.
- Open Company, Valuation and Research at a desktop viewport.
- Change a custom assumption: the full app must return a fresh Python result.
- Save a scenario and inspect Evidence → Checks & history; export JSON and check its assumptions/provenance.
- Restart the container and confirm saved SQLite runs remain.

Direct runtime, API, numerical and desktop-browser checks were performed for this release. Docker was unavailable in the build environment, so the Docker image itself was not built or run here. A live optional LLM provider call requires your own configuration and remains unverified.

## Updates and data

Reviewed source inputs are bundled; no scheduled live-market or news ingestion runs. Rebuild after a reviewed data update. The application never turns missing prices into a quote. Browser scenarios/import drafts are local to each browser; SQLite captures explicitly persisted valuation runs on the server. Download exports before clearing browser storage.
