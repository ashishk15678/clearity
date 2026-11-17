# ops — Infrastructure & CI/CD

Infra-as-code and deployment artefacts for the Clarity platform.

## CI/CD

GitHub Actions workflows live at `.github/workflows/`:

| Workflow | Trigger | What it does |
|---|---|---|
| `web.yml` | changes to `apps/web/**` or `packages/sdk/**` | type-check, lint, `next build`, SDK presence check |
| `ingest.yml` | changes to `apps/ingest/**` or root `Cargo.toml` | `cargo fmt`, `clippy -D warnings`, `cargo test`, release binary on `main` |
| `ci.yml` | every push/PR | gate job (required status check) |

## Secrets required

Set these in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Used by |
|---|---|
| `DATABASE_URL` | `web.yml` build, `ingest.yml` tests |
| `BETTER_AUTH_SECRET` | `web.yml` build |

## Deploying ingest

The `ingest.yml` workflow uploads a `ingest-binary` artifact on every `main` merge.  
Deploy options:

```bash
# Fly.io
fly deploy --app clarity-ingest --image ghcr.io/your-org/clarity-ingest:latest

# Railway
railway up --service ingest

# Any VPS
scp target/release/ingest user@host:/opt/clarity/ingest
DATABASE_URL="…" PORT=4000 /opt/clarity/ingest
```

## Dockerfile (ingest)

See `Dockerfile.ingest` in this directory.

## Environment variables

```
# apps/ingest
DATABASE_URL=postgresql://…?sslmode=require
PORT=4000               # default 4000

# apps/web
DATABASE_URL=postgresql://…?sslmode=require
BETTER_AUTH_SECRET=…
BETTER_AUTH_URL=https://your-domain.com
NEXT_PUBLIC_BETTER_AUTH_URL=https://your-domain.com
```
