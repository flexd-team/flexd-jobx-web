# JobX — Evidence-first workspace

## Acuan dan cakupan

Desain aplikasi diadaptasi dari prototype pengguna `D:\JobX-project.zip`, khususnya
`DESIGN_SYSTEM.md`, shell workspace, navigasi per role, pola artifact/evidence, dan wizard JD.
Dokumen ini menggantikan referensi Notion umum atas persetujuan pengguna.
Tidak menggunakan logo atau layar proprieter Notion.

## Foundations

| Token | Nilai | Fungsi |
| --- | --- | --- |
| Primary | `#5645D4` | Aksi utama, fokus, identitas JobX |
| Primary pressed | `#4534B3` | Hover aksi utama |
| Canvas | `#FFFFFF` | Area kerja |
| Surface | `#F6F5F4` | Sidebar, blok kode |
| Soft | `#FAFAF9` | Form dan keadaan kosong |
| Hairline | `#E5E3DF` | Border utama |
| Soft border | `#EDE9E4` | Pemisah ringan |
| Ink | `#1A1A1A` | Heading |
| Charcoal | `#37352F` | Teks utama |
| Secondary | `#68655F` | Teks bantu, kontras diperkuat dari prototype |
| Lavender | `#E6E0F5` | Skill, konteks AI |
| Mint | `#D9F3E1` | Status positif |
| Peach | `#FFE8D4` | Pending/proses |
| Rose | `#FDE0EC` | Penolakan/status negatif |

Font stack: Inter-compatible/system sans dari `src/index.css`; tidak menambah request font
Google eksternal. Heading workspace 27–30px, section 17–18px, body 13–14px, metadata 10–12px.
Display publik responsif 36–57px. Tracking heading tidak kurang dari -0.035em.
Spacing memakai kelipatan 4px dengan gutter responsif. Tombol/input 7–8px, kartu 11px,
container besar 12–14px. Shadow hanya ringan dan ber-offset pada ilustrasi/preview.

## Shell

- Desktop: sidebar 250px, breadcrumb 58px, konten fleksibel maksimum 1440px.
- Tablet ≤960px: sidebar ikon 76px, label tetap tersedia lewat title/accessible name.
- Mobile ≤700px: drawer navigasi, scrim, tombol buka/tutup; konten satu kolom.
- Sidebar mengikuti role akun. Tidak ada role switch atau token simulasi.
- Landing/auth publik memakai header dan footer terpisah dari shell workspace.
- Navigasi lama `/workspace`, `/jobs`, `/profile` dialihkan ke area role terkait.

## Komponen

- `components/layout/app-shell.tsx`: brand, role navigation, breadcrumb, logout browser.
- `components/portal-ui.tsx`: heading, pencarian, feedback request, empty state, status badge.
- `components/artifact-editor.tsx`: metadata, visibilitas, kontribusi self-declared.
- `styles/prototype.css`: visual sistem dengan prefix `jx-`; tidak menimpa semua komponen lama.
- Form baru memakai React Hook Form + Zod; response API divalidasi runtime.
- Grid koleksi dua kolom desktop, satu kolom mobile. Tabel admin scroll di container.
- Detail evidence/pekerjaan memakai disclosure. Tidak mengklaim drawer modal prototype
  sudah dipindahkan seluruhnya.

## Layar

Kandidat: overview, profil, artifacts, evidence, jobs, matches, settings.
Employer: overview, company, my-jobs, create-job, candidates, matches, settings.
Admin: overview, users, skills, aliases, settings.
GitHub: integrasi yang sudah ada dipertahankan. Auth nyata tetap melalui API aplikasi.

Wizard JD: kebutuhan bisnis → edit draft → review → simpan draft. Generate tidak
memublikasikan pekerjaan; publikasi self-service diblokir sampai workflow approval tersedia.

## Semantik dan states

- Confidence mengukur keyakinan identifikasi, bukan kemampuan kandidat.
- Direct/inferred tetap dibedakan. Candidate confirmed bukan reviewer verified.
- Skor ditampilkan dari backend tanpa skor sintetis atau perhitungan LLM di frontend.
- Error request tidak diganti data demo. Empty, loading, disabled, dan retry punya UI jelas.
- ID, amount, dan DECIMAL tetap string di kontrak; format amount memakai BigInt.
- Private/unlisted tidak ditampilkan sebagai evidence untuk employer.
- Tidak membuat fitur recovery email, notifikasi, dan upload generik palsu.

## Aksesibilitas dan verifikasi

Label form terasosiasi; skip link, focus-visible, aria-label tombol ikon, reduced-motion,
selection/caret dan scrollbar bertema. Navigasi mobile diuji lewat browser pada 390px;
landing/workspace tidak horizontal overflow pada capture tersebut. Test UI memakai API mock;
bukan bukti seluruh workflow nyata atau kesetaraan pixel semua layar prototype.
