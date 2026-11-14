# flexd-jobx-web

Monorepo JobX: portfolio artifacts, evidence-based skills, and job matching.

## Scope

- Backend: Python 3.11+, uv, FastAPI, SQLAlchemy async, MySQL 8, LangChain + LangGraph.
- Frontend: React, TypeScript strict, Vite, Tailwind CSS 4, shadcn-style owned components,
  React Hook Form, Zod, Redux Toolkit.
- Explicit CRUD for all 12 existing tables; CRUD is restricted to active admins.
- Authentication: public registration, login, current user, change password. No refresh/logout.
- Frontend is a scaffold with a local-only validated form, not an auth/CRUD dashboard.
- OpenAI-compatible LLM factory and dependency-injected LangGraph workflows; no `LLM_PROVIDER`.
  Workflows are not exposed through API endpoints. Live artifact readers and S3 operations
  are not implemented.

## Backend setup

Run these steps from `backend/`:

1. Copy `.env.example` to `.env` and configure your database credentials.
2. Generate a JWT secret with `uv run python -c "import secrets; print(secrets.token_hex(32))"`
   and set `JWT_SECRET_KEY`. Never commit this value.
3. Run `uv sync --locked`.
4. Run `uv run uvicorn app.main:app --reload`.

API documentation: <http://localhost:8000/docs>. No startup migrations, `create_all`, seeds,
DB writes, LLM calls, or S3 calls. Application tables must already exist.

### GitHub OAuth development flow

Model metadata now includes a thirteenth table, `user_oauth_identity`. This is an internal
identity mapping, not a new CRUD API. GitHub login/register, account linking and public
repository import are available for local development.

Optional backend settings `APP_GITHUB_CLIENT_ID`, `APP_GITHUB_CLIENT_SECRET`,
`APP_GITHUB_CALLBACK_URL`, and `APP_GITHUB_FRONTEND_CALLBACK_URL` configure OAuth.
Keep the client secret only in the ignored backend `.env`; use HTTPS callback URLs outside
local development and register the exact callback URL in the GitHub OAuth App.

The OAuth implementation uses bounded in-memory state and one-time handoffs. Use exactly one
backend process: restart interrupts pending authentication and multiple workers cannot share
state. OAuth authorization is disabled when `APP_ENV=production`; a shared store and security
review are required before production. Use `localhost` consistently for frontend and backend;
the browser binding cookie is host scoped. JobX JWT is stored only in Redux memory and is lost
on page reload or navigation to GitHub. Login again after linking. No GitHub token is persisted.
The frontend route `/github` includes password login, GitHub login/register, linking and import.

Endpoints: `POST /auth/github/authorize`, `GET /auth/github/callback`,
`POST /auth/github/exchange`, `POST /auth/github/register`,
`POST /integrations/github/authorize`, `GET/DELETE /integrations/github/connection`,
`GET /integrations/github/repositories` and `POST /artifacts/github/import` under `/api/v1`.
Import only supports public repositories owned by the connected GitHub user. It creates an
artifact and self-declared contribution but does not fetch source code or run AI analysis.
Repository listing uses unauthenticated GitHub API and is subject to its IP rate limits.

- `provider` currently supports only `github`; `provider_user_id` stores stable GitHub user ID
  as a string, never username/email. Tokens and client secrets are not stored in this table.
- Unique `(provider, provider_user_id)` prevents identity sharing across JobX accounts.
- Unique `(user_id, provider)` permits one GitHub identity per JobX account.
- User deletion cascades to its identities through the DB foreign key.
- `user.password_hash` is nullable for future OAuth-only accounts. Public/admin password
  registration still requires a password. Password login fails with the same generic 401
  when no hash exists; change-password still requires the existing password and returns 422
  for OAuth-only accounts. No first-password or automatic email-based linking flow is added.

Manual migration: `backend/scripts/migrations/001_github_oauth_identity.sql`.
It is **not executed automatically** and has not been applied by this change.

Before deploying these models to an existing MySQL schema:

1. Back up the target database and review the migration with its operator. Confirm MySQL 8,
   InnoDB, `user.id` as unsigned BIGINT, and `password_hash` as VARCHAR(255) without custom
   column attributes that `MODIFY COLUMN` would remove.
2. Select the intended database explicitly in your SQL client. Inspect existing schema and
   confirm `user_oauth_identity` does not already exist. Execute the reviewed SQL during a
   maintenance window. Never pass database passwords in command arguments or commit them.
3. Verify both unique constraints, foreign key, and nullable password column before deploying.

MySQL DDL implicitly commits; migration is not atomic. If a statement fails, inspect actual
schema before retrying. No automatic downgrade: restoring NOT NULL fails while OAuth-only
users exist, and dropping the identity table removes login mappings. Plan recovery with a
backup; never fill missing hashes with dummy passwords. SQLite tests cover identity uniqueness,
FK/cascade and password behavior, not live MySQL migration, collation or concurrency.

The development DB connection explicitly disables TLS when `DB_TLS_ENABLED=false`.
Unencrypted database connections expose traffic to network observers; use a trusted private
network or SSH tunnel. Enable TLS with certificate validation for production.

First admin: `uv run python -m scripts.provision_admin`. This is an explicit write command;
it asks for password confirmation and `CREATE ADMIN` before creating an account. It is never
run automatically. Existing emails are not overwritten or promoted.

### Environment

All application settings use `APP_*`, `DB_*`, `STORAGE_*`, `JWT_*`, or `LLM_*`.
`APP_CORS_ORIGINS` is a JSON array. See `backend/.env.example` for all settings.

LLM setup: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_TEMPERATURE`,
`LLM_TIMEOUT_SECONDS`, `LLM_MAX_RETRIES`. Credentials are passed explicitly to `ChatOpenAI`.
No provider-specific env names are required. Missing LLM/storage credentials do not prevent
normal CRUD/auth startup; their factories fail only when called without configuration.

`STORAGE_ACL=false` means future uploads should omit ACL entirely; it does not make objects
public. `STORAGE_PUBLIC_URL` is only a configured URL, not a bucket-policy change.

### API routes

Prefix: `/api/v1`. Each resource has POST/list GET/detail GET/PATCH/DELETE:

| Table | URL resource | Detail/list response keys |
| --- | --- | --- |
| `user` | `/users` | `user` / `users` |
| `candidate_profile` | `/candidate-profiles` | `candidate_profile` / `candidate_profiles` |
| `company_profile` | `/company-profiles` | `company_profile` / `company_profiles` |
| `artifact` | `/artifacts` | `artifact` / `artifacts` |
| `artifact_analysis` | `/artifact-analyses` | `artifact_analysis` / `artifact_analyses` |
| `artifact_contribution` | `/artifact-contributions` | `artifact_contribution` / `artifact_contributions` |
| `artifact_skill_evidence` | `/artifact-skill-evidences` | `artifact_skill_evidence` / `artifact_skill_evidences` |
| `skill` | `/skills` | `skill` / `skills` |
| `skill_alias` | `/skill-aliases` | `skill_alias` / `skill_aliases` |
| `job_post` | `/job-posts` | `job_post` / `job_posts` |
| `job_skill_requirement` | `/job-skill-requirements` | `job_skill_requirement` / `job_skill_requirements` |
| `job_match` | `/job-matches` | `job_match` / `job_matches` |

Detail IDs use `id`, except candidate profiles which use `user_id`. List parameters: `limit`
(1–100, default 20), `offset` (default 0). Lists sort by primary key ascending.
Ownership foreign keys are immutable on PATCH except `skill_alias.skill_id` and
`skill.parent_skill_id`; recreate a resource to change its ownership. Unknown fields are rejected.

Auth:

```http
POST  /api/v1/auth/login
POST  /api/v1/auth/register
GET   /api/v1/auth/me
PATCH /api/v1/auth/password
```

Register JSON: `{"name":"Budi","email":"budi@example.com","password":"strong-password-123","account_type":"candidate"}`.
Public registration accepts only `candidate` or `employer`; admin role and client-supplied
account status are rejected. Accounts are active, without automatic profile creation or
email verification. HTTP 201 returns only `data.user`; login separately to obtain a token.
Duplicate emails return HTTP 409. Registration is independently limited by
`APP_REGISTER_RATE_LIMIT` (default 5) and `APP_REGISTER_WINDOW_SECONDS` (default 60), per IP/process.

Login JSON: `{"email":"admin@example.com","password":"your-password"}`.
Successful login returns `data.user` and `data.auth` containing `access_token` and
`token_type`. Protected requests use `Authorization: Bearer <access_token>`.
Change-password JSON: `{"current_password":"...","new_password":"..."}`.
New passwords require 12–128 characters and are hashed with Argon2. Unknown legacy password
hashes fail closed; no guessed compatibility. Passwords are never stripped or logged.

Tokens verify signature, fixed algorithm, issuer, audience, subject, and expiry. Current
account status/role is checked from DB on every protected request. Password changes do not
revoke previously issued tokens; they remain valid until expiry. Use short expiry.
Login limit is per process/IP; configure a shared trusted gateway rate limit for multiple workers.

### Response contract

Detail/create/update: only singular resource key.

```json
{
  "message": {"success": "Skill alias retrieved"},
  "error": {},
  "data": {"skill_alias": {"id": "12", "skill_id": "1", "alias_name": "ReactJS", "normalized_alias": "reactjs"}}
}
```

List: only plural resource key plus pagination.

```json
{
  "message": {"success": "Skill aliases retrieved"},
  "error": {},
  "data": {
    "skill_aliases": [],
    "pagination": {"total": 0, "limit": 20, "offset": 0}
  }
}
```

Delete returns HTTP 200 with `data: {}`. Errors keep the envelope with `data: {}` and
attribute/entity descriptions under `error`. HTTP codes: 201 create, 401 auth, 403 role,
404 missing, 409 conflict, 422 validation, 429 login limit, 500 internal.
BIGINT IDs/amounts and DECIMAL values are JSON strings to avoid JavaScript precision loss.
Send large integer input as a string too. Datetime fields use UTC by application convention;
existing MySQL DATETIME columns have no timezone information.

FastAPI's `/docs`, `/openapi.json`, redirects, and protocol-level responses such as CORS
preflight retain framework-native formats; the envelope applies to application API responses.

### Domain safeguards

- Last active admin cannot be removed, deactivated, or demoted.
- Candidate/company/job owners must have the appropriate account role.
- Parent skill changes reject cycles and lock the hierarchy during writes.
- Artifact requires source URL or storage key; project dates must be ordered.
- Evidence analysis must belong to the same artifact.
- Salary ranges, scores, precision, enums, required fields, and foreign keys are validated.
- Published jobs require approval; match status must agree with both decisions.
- Database CASCADE/RESTRICT/SET NULL behavior is preserved. Admin DELETE can cascade;
  review affected data before calling it. No soft-delete columns are invented.
- `normalized_alias` is trimmed/lowercased by the server, not accepted from client input.

## Frontend setup

Node.js 22.12+ (22.x), 24.x, or 26+ is required by current test tooling.
From `frontend/`: copy `.env.example` to `.env`, run `npm ci`, then `npm run dev`.
Only `APP_PUBLIC_*` is exposed to browser code. Never put DB, AWS, JWT, or LLM secrets in
frontend env. API client validates envelopes and accepts a token explicitly; it does not
persist tokens in localStorage. Configure SPA fallback to `index.html` on deployment.

## Checks

Backend, from `backend/`:

```sh
uv run ruff check .
uv run ruff format --check .
uv run pytest -q
```

Portable SQLite tests exercise all 60 CRUD operations, authentication, role restrictions,
response envelopes, and domain checks. They do not prove MySQL collation, unsigned bounds,
row locking/concurrency, or server timestamp behavior.

MySQL integration is opt-in: precreate matching tables in a dedicated local `*_test` schema,
set `DB_TEST_URL=mysql+asyncmy://...@127.0.0.1/jobx_test`, and run
`uv run pytest tests/test_mysql_integration.py -q`. The test rejects nonlocal hosts and
schemas without `_test`, uses an outer rollback, and does not create/drop application tables.

Frontend, from `frontend/`:

```sh
npm run lint
npm run test
npm run build
```

## Layout

Backend flow: routes (HTTP/dependencies), controllers (response), services
(queries/transactions/rules), models (ORM), schemas (input/output). Shared config and utilities
contain no dynamic client-selected table/column SQL. `agents/` contains isolated AI workflows.
Frontend folders: assets, components, hooks, lib, schemas, pages, types, redux.

## AI workflow scaffold

Three explicit graph factories live under `backend/app/agents/`:

- `artifact_analysis.graph.build_artifact_analysis_graph`: validate input, ingest artifact,
  enforce content budgets/secret guard, analyze contribution context, normalize skill aliases,
  validate exact source citations, and return typed analysis results. Schema/citation failures
  allow one repair by default (configurable through injected context, maximum two).
- `job_descriptor.graph.build_job_descriptor_graph`: generate an employer-reviewable draft,
  resolve skill requirements and validate exact supporting quotes. No approval/publication.
  Quote validation is not semantic proof: all generated prose still requires employer review.
- `matching.graph.build_matching_graph`: deterministic Decimal scoring, evidence aggregation,
  and explanation from known facts. Optional model can only reorder all known fact IDs;
  invalid output or recognized network/provider failures fall back to a template.

Graph execution does not query/write DB, authorize users, schedule workers, or persist checkpoints.
Services must supply authorized snapshots, filter visibility, check job expiry, select current
analysis evidence, and persist results atomically. Do not hold a DB transaction during model I/O.
Unexpected errors propagate to caller; caller must record safe failure status. This scaffold
does not provide durable background execution or automatic retry of network failures. The LLM
client retains existing `LLM_MAX_RETRIES` behavior; graph repairs address output validation only.

### Artifact ingestion

`services/artifact_ingestion/dispatcher.py` selects an injected read-only reader by artifact type.
All seven types have a contract, **none has a built-in live reader yet**, including GitHub.
Unregistered types return `unsupported` without a model call. Registered readers must return
`ArtifactContent`: Markdown, source blocks/locations, revision, media references and limitations.
No `.md` file is written. Reader implementations must independently enforce source/redirect
allowlists, MIME checks, file/decompression/time budgets, sensitive-path filtering and secret
scanning; the graph's regex guard is defense in depth, not a full secret scanner.

Current model path is text-only. Media references are neither fetched nor sent to model;
image/video need a real OCR/transcription/vision adapter before visual analysis is possible.
Content without citable text returns `needs_review`, not fabricated evidence.
Only supplied source blocks may be cited. Unknown/ambiguous skills remain unresolved, never
create master skill records. One evidence per canonical skill is returned to respect current
`(analysis_id, skill_id)` uniqueness; first valid citation wins. Empty findings mean no evidence
found, not that candidate lacks competence. Model confidence is not measured competence.

### Calling a graph (from backend code)

```python
from app.agents.job_descriptor.graph import build_job_descriptor_graph
from app.agents.job_descriptor.schemas import JobInput
from app.agents.shared.context import ModelContext
from app.agents.shared.structured_output import LangChainStructuredModel

# Construction/import does not call provider. ainvoke below does call configured LLM.
graph = build_job_descriptor_graph(ModelContext(model=LangChainStructuredModel()))
# result = await graph.ainvoke({"input": JobInput(business_problem="Build an inventory API")})
# draft = result["result"]
```

Adapter uses existing lazy `create_llm()`. Default structured output method is `json_schema`;
inject `method="function_calling"` or `method="json_mode"` only if endpoint supports it.
OpenAI-compatible chat does not guarantee structured-output or multimodal support.
Prompt versions are included in artifact/JD results; calling service must also record actual
model identity. Never log/store full graph state or raw model messages: these can contain
private source content, including content rejected by guards. Persist only approved sanitized
result fields. Artifact `needs_review` maps to analysis `needs_human_review`; `unsupported`
is a workflow outcome, not a new database enum.

### Experimental matching policy

PRD component weights: required 0.50, preferred 0.20, evidence 0.20, preferences 0.10.
Absent requirement groups and unknown preferences are excluded and remaining weights normalized.
At least one requirement is required; requirement IDs must be unique, weights positive.
Coverage uses eligible evidence presence. Rejected evidence is excluded. Evidence quality uses
review factors 0.50/0.75/1.00 for ai_suggested/candidate_confirmed/reviewer_verified; inferred
evidence receives a further factor of 0.60. Best evidence per skill wins, duplicates never add
coverage. Quality is averaged across requirements by weight; missing evidence contributes zero.
Available preference factors (0–100, computed by service) are averaged equally.
Formula version `matching-v1-experimental` is an explicit initial policy, not validated hiring
prediction or final product configuration. Decisions/swipes are never touched by these graphs.

Offline workflow tests: `uv run pytest tests/test_agent_workflows.py -q` from `backend/`.
Tests inject fake readers/models; do not call GitHub, paid LLM endpoints, S3 or remote DB.

Dependency note: frontend overrides the ESLint parser's transitive `minimatch` to patched
11.x because its declared 9.x range is affected by GHSA-g3hv-75wg-m249. Remove the override
after typescript-eslint adopts a patched range. Lint, tests, and build are checked with it.
