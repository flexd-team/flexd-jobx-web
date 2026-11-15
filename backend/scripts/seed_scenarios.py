"""Realistic fictional portfolio fixtures; not verified candidate history."""

SCENARIOS = [
    {
        "key": "backend",
        "title": "Sistem Inventori dan Pemesanan Gudang",
        "job_title": "Backend Developer — Inventory Platform",
        "slug": "python",
        "description": "API inventori multi-gudang dengan pencatatan stok masuk/keluar, "
        "reservasi pesanan, dan laporan pergerakan barang menggunakan Python dan FastAPI.",
        "contribution": "Merancang endpoint stok dan pesanan, validasi payload, transaksi "
        "database, serta pengujian untuk mencegah stok negatif saat reservasi.",
        "role": "Backend Developer",
        "share": "65",
        "confidence": "0.86",
        "score": "82.50",
        "problem": "Tim operasional masih merekap stok melalui spreadsheet terpisah sehingga "
        "reservasi pesanan dan ketersediaan barang sering tidak sinkron.",
        "requirements": "Mampu membangun API Python, memahami transaksi SQL, dan menulis test.",
        "salary_min": 9000000,
        "salary_max": 14000000,
        "work_mode": "remote",
        "candidate_decision": "pending",
        "employer_decision": "pending",
    },
    {
        "key": "frontend",
        "title": "Dashboard Analitik Penjualan Ritel",
        "job_title": "Frontend Developer — Retail Analytics",
        "slug": "react",
        "description": "Dashboard React untuk pemantauan omzet, tren pesanan, dan performa "
        "cabang dengan filter periode, tabel paginasi, serta ekspor laporan.",
        "contribution": "Membangun komponen filter dan tabel, menghubungkan API laporan, "
        "dan menangani loading, error, empty state, serta navigasi keyboard.",
        "role": "Frontend Developer",
        "share": "70",
        "confidence": "0.91",
        "score": "89.25",
        "problem": "Manajer cabang membutuhkan ringkasan penjualan harian yang mudah "
        "dibaca tanpa menggabungkan laporan dari beberapa sistem secara manual.",
        "requirements": "Menguasai React, integrasi REST API, dan antarmuka responsif.",
        "salary_min": 8500000,
        "salary_max": 13000000,
        "work_mode": "hybrid",
        "candidate_decision": "accepted",
        "employer_decision": "pending",
    },
    {
        "key": "fullstack",
        "title": "Portal Pemesanan Layanan Pelanggan",
        "job_title": "Full-stack Developer — Customer Portal",
        "slug": "typescript",
        "description": "Portal TypeScript untuk pemesanan layanan, penjadwalan kunjungan, "
        "pelacakan status permintaan, dan pengelolaan akun pelanggan.",
        "contribution": "Mengembangkan form pemesanan bertipe, kontrak request/response, "
        "validasi jadwal, dan halaman riwayat permintaan yang terhubung ke API.",
        "role": "Full-stack Developer",
        "share": "60",
        "confidence": "0.88",
        "score": "86.75",
        "problem": "Permintaan layanan melalui chat sulit dilacak dan jadwal teknisi "
        "sering bertabrakan; dibutuhkan satu portal untuk pelanggan dan operasional.",
        "requirements": "Memahami TypeScript, validasi form, API, dan pemodelan data.",
        "salary_min": 10000000,
        "salary_max": 16000000,
        "work_mode": "remote",
        "candidate_decision": "accepted",
        "employer_decision": "accepted",
    },
    {
        "key": "testing",
        "title": "Pengujian Integrasi API Pembayaran",
        "job_title": "QA Engineer — Payment Integration",
        "slug": "rest-api",
        "description": "Suite pengujian integrasi pembayaran untuk pembuatan transaksi, "
        "callback status, validasi signature, dan penanganan callback berulang.",
        "contribution": "Menyusun skenario sukses dan gagal, fixture transaksi, assertion "
        "response API, serta pengujian idempotensi callback tanpa transaksi uang nyata.",
        "role": "QA Engineer",
        "share": "80",
        "confidence": "0.84",
        "score": "74.00",
        "problem": "Integrasi pembayaran memerlukan regression test yang konsisten "
        "untuk mendeteksi perubahan kontrak API sebelum rilis.",
        "requirements": "Mampu menguji REST API, menganalisis HTTP response, "
        "dan menulis test case.",
        "salary_min": 8000000,
        "salary_max": 12000000,
        "work_mode": "hybrid",
        "candidate_decision": "rejected",
        "employer_decision": "pending",
    },
]
