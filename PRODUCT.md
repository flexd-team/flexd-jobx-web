# JobX

JobX menghubungkan karya kandidat, evidence skill, dan kebutuhan pekerjaan perusahaan.
Bahasa utama UI Indonesia; label navigasi mengikuti prototype pengguna.

## Arah yang disetujui

- Prototype `D:\JobX-project.zip` menjadi acuan visual seluruh area.
- Kandidat: profil, artifacts, kontribusi, evidence, pencarian pekerjaan, keputusan match.
- Employer: perusahaan, penyusunan JD, pekerjaan, review kandidat, keputusan match.
- Admin: operasional akun, canonical skills, aliases.
- CRUD generik admin-only; workflow self-service diperiksa role/ownership di server.
- Pertahankan login/OAuth/API nyata. Jangan membawa role switch demo atau data sintetis
  sebagai fallback ketika request gagal.
- Confidence bukan kemampuan; skor bukan peluang diterima. Keputusan tetap manusia.

## Batas implementasi

Publikasi self-service menunggu workflow approval yang belum dikonfigurasi. Pembuatan pekerjaan
baru menyimpan draft. Tidak mengklaim reset password melalui email, notifikasi, upload semua
format, atau analisis media nyata yang belum diverifikasi.
