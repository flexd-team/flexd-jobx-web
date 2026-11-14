# Panduan agent — flexd-jobx-web

## Cakupan dan konteks

Panduan ini berlaku untuk seluruh repo. Ikuti instruksi pengguna dan panduan yang lebih
spesifik di subfolder jika tersedia. Baca kode terkait sebelum mengubahnya; README.md
menjelaskan setup dan kontrak aplikasi. Jangan menganggap rencana lama sebagai fitur yang
sudah tersedia.

JobX menghubungkan portfolio kandidat, bukti skill, dan kebutuhan pekerjaan perusahaan.
Repo berbentuk monorepo backend/frontend, bukan satu aplikasi dengan dependency bersama.

- Backend: Python 3.11+, uv, FastAPI, Pydantic 2, SQLAlchemy 2 async, asyncmy, MySQL 8.
- AI: LangChain, LangGraph, langchain-openai untuk API OpenAI-compatible.
- Frontend: TypeScript strict, React, Vite, Tailwind CSS 4, komponen shadcn-style/Radix,
  React Hook Form, Zod, Redux Toolkit.
- Node.js mengikuti `frontend/package.json`: 22.12+ pada 22.x, 24.x, atau 26+.
- Frontend saat ini scaffold dengan contoh form lokal, bukan dashboard CRUD/auth lengkap.

## Batas perubahan

- Kerjakan hanya lingkup permintaan. Jangan menambah workflow AI, upload S3, UI CRUD,
  migrasi, atau dependency tanpa kebutuhan yang jelas.
- Jangan menimpa, mengembalikan, atau menghapus pekerjaan pengguna. Periksa perubahan
  yang sudah ada sebelum melakukan refactor atau penghapusan.
- Jangan menjalankan reset destruktif, commit, push, atau provisioning tanpa izin pengguna.
- Jangan menjalankan perintah tulis terhadap DB remote sebagai bagian pengujian biasa.
- Jangan menyatakan test berhasil jika belum dijalankan. Sebutkan test yang dilewati,
  kegagalan, serta batas verifikasi pada ringkasan akhir.
- Dokumentasikan perubahan endpoint, env, dan cara menjalankan di README.md bila relevan.

## Struktur backend

```text
backend/
  app/
    main.py          # lifecycle aplikasi, middleware, pemasangan router
    configs/         # settings, database, dependency auth, logging, factory integrasi
    routes/          # HTTP method/path, request schema, dependency akses
    controllers/     # pemanggilan service, serialisasi dan response
    services/        # query, transaksi, aturan domain
    models/          # pemetaan ORM sesuai skema DB
    schemas/         # input/output Pydantic dan tipe bersama
    middlewares/    # exception handler dan konteks request
    utils/          # security, response, error DB, rate limit
    agents/         # graph artifact/JD/matching; belum terhubung endpoint atau worker
  scripts/          # perintah operator eksplisit
  tests/
```

### Pola kode

- Tiap resource punya file model, schema, service, controller, dan route eksplisit.
  Contoh: `skill_alias.py`, `skill_alias_service.py`,
  `skill_alias_controller.py`, `skill_alias_route.py`.
- Gunakan fungsi bernama jelas: `list_skill_aliases`, `get_skill_alias`,
  `create_skill_alias`, `update_skill_alias`, `delete_skill_alias`.
- Routes menangani dependency FastAPI; service tidak bergantung pada Request/Response HTTP.
- Query dan transaksi berada di service, bukan controller atau route.
- Gunakan AsyncSession; await operasi DB. Hindari blocking network I/O di endpoint async.
- Gunakan schema input terpisah dari output. Tolak field tambahan melalui pola `Input`.
- PATCH memakai `model_dump(exclude_unset=True)`. Bedakan field tidak dikirim dari `null`;
  tolak explicit null untuk kolom wajib. Pertahankan field ownership yang immutable.
- Shared helper boleh untuk aturan bernama atau envelope, bukan CRUD dinamis yang menerima
  nama tabel/kolom dari client. Filter/sort baru harus memakai allowlist eksplisit.
- Tulisan gagal harus rollback. Refresh nilai server sebelum commit jika diperlukan;
  session memakai `expire_on_commit=False`.
- Terjemahkan error DB menjadi error domain yang aman. Jangan kirim SQL, parameter query,
  traceback, kredensial, atau isi exception DB mentah ke client/log.
- Format Python dengan Ruff, line length 100; ikuti gaya file sekitarnya.

## Database dan aturan domain

Model skema kini punya 13 tabel; tabel identitas OAuth memerlukan migrasi manual pada DB lama:

```text
user                    candidate_profile          company_profile
artifact                artifact_analysis          artifact_contribution
artifact_skill_evidence skill                      skill_alias
job_post                job_skill_requirement      job_match
user_oauth_identity
```

- `candidate_profile` memakai PK `user_id`; tabel lain memakai `id`.
- `user_oauth_identity` internal, tanpa CRUD publik/admin. Unique `(provider, provider_user_id)`
  dan `(user_id, provider)`; FK user memakai CASCADE. Tidak menyimpan token atau secret.
- `user.password_hash` nullable untuk OAuth-only. Login password harus gagal aman ketika null;
  registrasi password tetap wajib password. OAuth/linking memakai state satu proses untuk dev;
  jangan mengaktifkannya di produksi tanpa shared store dan audit keamanan.
- Pertahankan unsigned BIGINT, enum, JSON, precision DECIMAL, nullability, default,
  unique constraint, serta aturan FK CASCADE/RESTRICT/SET NULL.
- Jangan menjalankan `create_all`, seed, atau migrasi pada startup/DB remote.
  Perubahan skema perlu persetujuan eksplisit, bukan efek samping perubahan model.
- Admin terakhir yang aktif tidak boleh dihapus, dinonaktifkan, atau diturunkan role-nya.
- Profil kandidat harus menunjuk candidate; company/job harus menunjuk employer.
  Perubahan role tidak boleh meninggalkan data khusus role yang tidak konsisten.
- Parent skill tidak boleh membentuk siklus. Pertahankan lock dan urutan lock yang konsisten
  untuk perubahan hierarki/admin; test SQLite tidak membuktikan keamanan konkurensi MySQL.
- Artifact wajib punya source URL atau storage key; tanggal proyek harus berurutan.
- Analysis pada evidence harus berasal dari artifact yang sama.
- Validasi rentang gaji, score, confidence, contribution share, precision, dan FK.
- Job hanya boleh published jika approved. Match status harus sesuai kedua keputusan.
- `normalized_alias` dihitung backend dari alias yang di-trim dan lowercase.
- DELETE memakai perilaku DB aktual dan dapat cascade; jangan mengubahnya menjadi
  soft delete atau menambahkan cascade ORM tanpa pembahasan.
- DATETIME memakai konvensi UTC aplikasi; kolom MySQL tersebut tidak menyimpan timezone.

## Kontrak API

Prefix default `/api/v1`. CRUD memakai POST, list GET, detail GET, PATCH, DELETE.
List default `limit=20`, maksimal 100, `offset=0`, urutan PK ascending.

Semua response aplikasi punya envelope:

```json
{
  "message": {"success": "Skill alias retrieved"},
  "error": {},
  "data": {
    "skill_alias": {
      "id": "12",
      "skill_id": "1",
      "alias_name": "ReactJS",
      "normalized_alias": "reactjs"
    }
  }
}
```

- Detail/create/update: hanya key resource tunggal, misalnya `skill_alias`.
- List: hanya key jamak, misalnya `skill_aliases`, beserta `pagination` di dalam `data`.
  Jangan sertakan key tunggal kosong pada list atau key jamak kosong pada detail.
- Gunakan plural yang sudah ada: `artifact_analyses`, `job_matches`, dan key lain di README.
- DELETE: HTTP 200, `data: {}`. Jangan memakai 204 jika kontrak membutuhkan body.
- Error: `message.error`, deskripsi field/entity pada `error`, dan `data: {}`.
- Status: 201 create/register, 401 auth, 403 role, 404 missing, 409 conflict,
  422 validation, 429 rate limit, 500 internal.
- BIGINT ID/amount dan DECIMAL diserialisasi sebagai string untuk menjaga presisi JavaScript.
  Jangan mengubahnya menjadi number atau float tanpa perubahan kontrak yang disepakati.
- Docs/OpenAPI, redirect, dan CORS preflight tetap memakai format framework/protokol.

## Auth dan keamanan

Endpoint saat ini:

```http
POST  /api/v1/auth/register
POST  /api/v1/auth/login
GET   /api/v1/auth/me
PATCH /api/v1/auth/password
```

- Semua CRUD 12 tabel khusus admin aktif. Candidate/employer boleh mengakses auth/me dan
  mengganti password sendiri, bukan CRUD domain umum.
- Register publik hanya menerima candidate/employer, status active ditentukan backend.
  Tolak role admin dan account_status dari client. Tidak membuat profil atau token otomatis.
- Login mengembalikan `data.user` dan `data.auth`; register/me memakai `data.user`.
- Password baru minimal 12, maksimal 128 karakter. Gunakan Argon2 dari util security.
  Jangan trim password, mengekspos password/hash, atau menebak format hash legacy.
- JWT memverifikasi signature, fixed algorithm, issuer, audience, subject, dan expiry.
  Periksa role/status akun aktual dari DB, bukan percaya claim role dari client.
- Belum ada refresh token, logout/revocation, atau email verification. Ganti password tidak
  membatalkan JWT lama; jangan mengklaim sebaliknya.
- Login/register punya bucket rate limit terpisah per IP/proses. Multi-worker membutuhkan
  limiter bersama di gateway; jangan percaya forwarded IP dari proxy tak tepercaya.
- `scripts/provision_admin.py` adalah perintah tulis operator dengan konfirmasi,
  bukan fungsi startup atau endpoint publik.

## Environment dan integrasi

- Backend hanya memakai prefix `APP_*`, `DB_*`, `STORAGE_*`, `JWT_*`, `LLM_*`.
- Gunakan `configs/settings.py`; tambahkan setting baru ke `.env.example` dan dokumentasi.
  Jangan menimpa nilai `.env` pengguna ketika menambah setting dengan default.
- `.env` adalah rahasia lokal dan harus tetap diabaikan Git. Jangan menampilkan atau
  menyalin nilainya ke dokumentasi, test, output, commit, atau contoh request.
  Untuk inspeksi, utamakan `.env.example` dan status set/kosong tanpa nilai rahasia.
- Frontend hanya boleh mengekspos `APP_PUBLIC_*`. Jangan memperlebar `envPrefix` ke
  `APP_` atau seluruh env; DB/AWS/JWT/LLM secrets tidak boleh masuk browser bundle.
- CORS origins berupa JSON array dengan origin eksplisit.
- Development DB dapat memakai `DB_TLS_ENABLED=false` sesuai konfigurasi pengguna.
  Jangan mengubah mode TLS diam-diam. Produksi sebaiknya TLS terverifikasi/private network.
- LLM hanya OpenAI-compatible lewat `ChatOpenAI` dan `LLM_API_KEY`, `LLM_BASE_URL`,
  `LLM_MODEL`, `LLM_TEMPERATURE`, `LLM_TIMEOUT_SECONDS`, `LLM_MAX_RETRIES`.
  Jangan menambah `LLM_PROVIDER` atau mewajibkan `OPENAI_*`.
- Startup CRUD/auth harus tetap berjalan tanpa kredensial LLM/S3. Client dibuat lazy lewat
  factory. Jangan melakukan request berbayar atau upload/delete S3 tanpa kebutuhan/izin.
- `STORAGE_ACL=false` berarti omit ACL pada operasi mendatang, bukan membuat bucket publik.

## Konvensi frontend

```text
frontend/src/
  assets/       components/ui/   hooks/   lib/
  schemas/      pages/           types/   redux/
```

- Gunakan TypeScript strict, functional components, import alias `@/`.
- File custom kebab-case, nama komponen PascalCase; ikuti pengecualian entry seperti App.tsx.
- Komponen UI reusable berada di `components/ui/`; komposisi domain di luar folder itu.
  Pertahankan label, keyboard navigation, focus state, dan aria attributes.
- Form memakai React Hook Form + Zod. Turunkan tipe dari schema melalui `z.infer` jika sesuai;
  jangan menggandakan kontrak validasi secara manual.
- Redux Toolkit untuk state aplikasi; state input/error form tetap di React Hook Form.
  Pakai typed hooks yang sudah tersedia.
- Gunakan API client bersama dan validasi runtime response. Pertahankan error field/entity
  untuk ditampilkan pada form. Jangan menyimpan token di localStorage secara otomatis.
- Gunakan Tailwind 4 dan token CSS yang ada. Hindari mengganti desain/global CSS tanpa lingkup.
  Periksa mobile, loading/error/empty state, kontras, dan reduced-motion bila UI berubah.
- Jangan menghapus override keamanan dependency tanpa audit dan pengujian pengganti.

## Menjalankan dan memverifikasi

Jalankan perintah dari folder masing-masing, bukan root repo.

Backend (`backend/`):

```sh
uv sync --locked
uv run uvicorn app.main:app --reload --port 8000
uv run ruff check .
uv run ruff format --check .
uv run pytest -q
```

Frontend (`frontend/`):

```sh
npm ci
npm run dev -- --port 5173 --strictPort
npm run lint
npm run test
npm run build
npm audit
```

- Update lockfile melalui uv/npm bila dependency berubah; jangan edit lockfile manual.
- Tambahkan test untuk perubahan perilaku: happy path, input invalid, auth/role,
  response envelope, duplicate/FK, dan rollback jika relevan.
- Test default backend memakai SQLite sementara melalui dependency override; jangan memakai
  DB aplikasi untuk test tulis. SQLite tidak membuktikan collation, unsigned bounds, row locks,
  konkurensi, atau timestamp MySQL.
- Test MySQL opt-in membutuhkan tabel yang sudah tersedia pada DB lokal terpisah `*_test`
  lewat `DB_TEST_URL`. Pertahankan pemeriksaan host/schema dan outer rollback.
  Jangan mengurangi guard agar test bisa menyentuh DB remote.
- Smoke test UI bila memungkinkan. Laporkan perintah yang benar-benar dijalankan dan batasnya;
  jangan menaruh jumlah test tetap dalam panduan karena akan berubah.
