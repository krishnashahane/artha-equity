# Deploy Artha Equity v1.4.0

This package contains the complete Node + Python app and a prebuilt interface.
Python runs on the server; a static-only host cannot run this application.

## Deploy with Docker Compose

Install Docker with Compose, extract the ZIP, then open a terminal in the
`artha-equity` folder containing this file.

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Open `.env` and set `APP_AUTH_PASSWORD` to your own strong password.
   The default username is `research`. Do not share or commit `.env`.
   If an HTTPS reverse proxy fronts the app, uncomment `APP_PUBLIC_ORIGIN`
   and set it to the exact public origin, for example `https://research.example.com`.

3. Start the application:

   ```bash
   docker compose up --build -d
   ```

4. Open `http://localhost:3000` and sign in with your configured credentials.
   For a public deployment, configure your hosting platform's HTTPS endpoint
   or TLS proxy and keep the app's password protection enabled.

SQLite history persists in the `artha-research` Docker volume. Do not use
`docker compose down -v` unless you intend to delete that history.
To use another host port, add `APP_PORT=8080` to `.env` before starting.

## Deploy on a Docker hosting platform

Upload this folder or connect its source repository. Select the included
Dockerfile, container port `3000`, and set `APP_AUTH_PASSWORD` in the platform's
secret/environment settings. Set `APP_PUBLIC_ORIGIN` to the exact HTTPS public
origin when the platform terminates TLS. Mount persistent storage at
`/app/data/runtime`. `/api/health` is the public liveness endpoint;
`/api/ready` additionally checks Python, issuer reconciliations and SQLite and
requires the configured Basic auth credentials.

## Run without Docker

Requires Node 20+ and Python 3.10+. No npm/pip runtime installation is required.
The ZIP includes dist/, so you can start immediately after configuring `.env`:

```bash
NODE_ENV=production node --env-file=.env backend/server.mjs
```

The default .env binds to localhost. For a server/container host that needs to
accept external traffic, set `HOST=0.0.0.0`. Rebuild with `npm run build` after
changing the UI or reviewed data.

## Verification and scope

The full app checks, stdlib preflight and archive extraction/runtime smoke checks
were run when producing this ZIP. See docs/RELEASE_V1_4_0.md for the implementation
report. Docker image building and real browser visual/assistive-technology checks
have not been verified in this environment. Docker needs network access to pull
its base image and install Python during the image build.

Infosys is the reviewed valuation dataset; other companies can be onboarded with
the validated workflow in docs/COMPANY_ONBOARDING.md. Missing evidence stays
unavailable. This is an educational research application with explicit assumptions.

Run full developer tests after installing requirements.txt:

```bash
npm run check
npm run preflight
```
