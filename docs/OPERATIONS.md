# Operations for v1.4

## Admission and request logs

The app requires Node 20+ and Python 3.10+; production workers run Python with
`-S`, proving that site packages are not used. `PYTHON_WORKERS` defaults to 2
(1–8), `PYTHON_QUEUE_LIMIT` to 16 (0–128). Each admitted operation gets an isolated
Python process, with 30-second execution and 2 MiB stdout limits. FIFO queue wait
is at most 10 seconds. Saturation/timeouts return 503. This is a bounded process
worker pool, not a persistent interpreter pool.

Requests emit one JSON record on response finish: method, path without query,
status and durationMs. Bodies, authorization headers, credentials, provider keys
and tracebacks are never logged. Logs go to stdout; configure collection/rotation
at the process supervisor. The startup URL is a separate human-readable message.

Basic auth hashes both expected and provided strings to equal-length SHA-256
buffers before constant-time comparison. Ten failed sign-ins per socket IP within
60 seconds block further attempts for the remaining window with 429/Retry-After.
API operations retain the 90-request/minute limit and 32,000-byte body cap. Keep
HTTPS at the proxy; set `APP_PUBLIC_ORIGIN=https://research.example.com` to the
exact browser origin when terminating TLS at a reverse proxy. Proxy headers are
not trusted. IP limits use the socket address: a shared proxy shares that budget.

## Liveness and readiness

`GET /api/health` stays public for liveness. `GET /api/ready` is protected by the
same auth as the UI. Readiness invokes Python, validates every registered issuer's
model/reconciliations and checks that SQLite can open/create the run store.
It returns 200/ready or 503/unavailable. It uses the same bounded workers and API
budget; avoid rapid readiness polling. A ready response does not certify missing
prices, award dilution or analyst assumptions as reviewed.

## Retention and backup

SQLite uses WAL mode, a 10-second busy timeout, short transactions and explicitly
closed handles. `RESEARCH_RETENTION_DAYS` defaults to 365 (0–36500; 0 disables
expiry). Store initialization and saves remove expired rows. This deletes old
snapshots, not credentials or input evidence; immutable retained rows are never
rewritten. Keep data/runtime on persistent storage. Pruning is transaction-safe;
SQLite reclaims WAL pages through normal checkpoints.

Do not copy only the main .sqlite3 file from a live WAL database. Instead:

```bash
python3 -S scripts/backup_research.py --output /secure-backups/artha-2026-11-12.sqlite3
```

The script uses SQLite's online backup API, includes committed WAL changes,
checks destination integrity, and refuses to overwrite existing targets or the
live database. It does not prune history during backup. Keep backup files outside
the public directory/source package and restrict their filesystem permissions.
To restore: stop the service, preserve the old database and its WAL/SHM files,
move a verified backup to data/runtime/research.sqlite3, remove the old matching
WAL/SHM only after preserving them, restore service-user ownership, and restart.
Verify `/api/ready` and saved-run history. Schedule backup execution in your own
supervisor; no external deployment or schedule is created by this change.

## CI

GitHub reads `.github/` from the **repository root**, above `artha-equity 2/`.
Verify runs the full check and stdlib preflight with Node 20 and Python 3.12.
CodeQL analyzes JavaScript/TypeScript and Python. Dependabot checks GitHub Actions,
app npm metadata and test/notebook requirements weekly. These workflows become
active after the commits are pushed; they have not executed on GitHub here.

CodeQL configuration follows the [official action guidance](https://github.com/github/codeql-action#keeping-the-codeql-action-up-to-date-in-advanced-setups), using the supported v4 major tag and build-mode none for interpreted languages.

## Deployable ZIP

The deployment ZIP contains a single `artha-equity/` folder with the built dist/,
source, Dockerfile, compose.yaml, .env.example and START_HERE.md. Compose requires
a nonempty APP_AUTH_PASSWORD, overrides the container bind address/port, and keeps
SQLite in a named volume. The Docker context excludes .env and runtime history.
The prebuilt interface supports direct Node startup without npm/pip runtime installs.
