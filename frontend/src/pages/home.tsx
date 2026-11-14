import { Link } from 'react-router-dom'
import {
  FileText,
  Search,
  Sparkles,
  Users,
  CheckCircle2,
  Check,
  HelpCircle,
  Building2,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Callout } from '@/components/ui/callout'

export default function Home() {
  return (
    <div className="flex flex-col w-full">
      {/* Notion Deep Navy Hero Band (#0a1530) */}
      <section className="relative overflow-hidden bg-[#0a1530] text-white pt-20 pb-32 px-6 sm:px-12 text-center">
        {/* Decorative Brand Dots / Sticky Notes & Wire Mesh Accents */}
        <div className="absolute top-8 left-12 size-3 rounded-full bg-[#f5d75e] opacity-80" />
        <div className="absolute top-20 right-16 size-4 rounded-full bg-[#ff64c8] opacity-80" />
        <div className="absolute bottom-16 left-20 size-2.5 rounded-full bg-[#2a9d99] opacity-75" />
        <div className="absolute bottom-24 right-28 size-3.5 rounded-full bg-[#7b3ff2] opacity-80" />
        <div className="absolute top-1/2 left-6 size-2 rounded-full bg-[#dd5b00] opacity-60 hidden lg:block" />
        <div className="absolute top-1/3 right-8 size-2.5 rounded-full bg-[#1aae39] opacity-60 hidden lg:block" />

        <div className="relative mx-auto max-w-4xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs text-white/90 backdrop-blur-sm">
            <span className="size-2 rounded-full bg-[#1aae39] animate-pulse" />
            <span>JobX 2.0 · Platform Rekrutmen Berbasis Bukti Skill & Kode Nyata</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white leading-[1.1] max-w-3xl mx-auto">
            Skill punya bukti. <br />
            <span className="text-[#d6b6f6]">Peluang punya arah.</span>
          </h1>

          <p className="mx-auto max-w-2xl text-base sm:text-lg text-white/80 leading-relaxed font-normal">
            Bukan sekadar resume teks. JobX membaca repository GitHub dan artefak Anda, mengekstrak
            bukti kode konkret, dan mencocokkannya dengan kebutuhan teknis riil perusahaan melalui AI.
          </p>

          {/* Hero CTAs: Dominant Notion Purple Button (#5645d4) */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Link to="/workspace">
              <Button
                variant="primary"
                size="lg"
                className="bg-[#5645d4] hover:bg-[#4534b3] text-white font-medium text-base h-12 px-6 rounded-md shadow-lg"
              >
                Mulai Gratis Sebagai Kandidat
              </Button>
            </Link>
            <Link to="/jobs">
              <Button
                variant="secondary"
                size="lg"
                className="border-white/30 text-white hover:bg-white/10 font-medium text-base h-12 px-6 rounded-md"
              >
                Buka Job Studio (Employer)
              </Button>
            </Link>
          </div>
        </div>

        {/* Embedded Workspace Mockup Card (Breaks out of hero band with diffuse shadow) */}
        <div className="relative mx-auto max-w-5xl mt-14 -mb-48 text-left z-20">
          <div className="rounded-xl border border-[#e5e3df] bg-white p-5 sm:p-8 notion-shadow-hero text-[#37352f]">
            {/* Mockup Header bar */}
            <div className="flex flex-wrap items-center justify-between pb-5 border-b border-[#e5e3df] gap-3">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-[#e6e0f5] flex items-center justify-center text-[#5645d4]">
                  <FileText className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-[#1a1a1a]">
                    Analisis Bukti Skill & Matching Langsung
                  </h3>
                  <p className="text-xs text-[#787671]">
                    Repository: zexceed12300/ABL_2411082008 · Cabang: master
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="mint">92% Match Terverifikasi</Badge>
                <Badge variant="lavender">Gemini 2.5 Flash Lite</Badge>
              </div>
            </div>

            {/* Mockup Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
              {/* Evidence Snippet 1 */}
              <div className="rounded-lg border border-[#e5e3df] bg-[#fafaf9] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="lavender">FastAPI</Badge>
                  <span className="text-[11px] font-mono text-[#787671]">README.md:12</span>
                </div>
                <p className="text-xs text-[#5d5b54]">
                  Terdeteksi arsitektur API async dengan dependensi dependency injection FastAPI.
                </p>
                <div className="notion-code-block text-[11px] bg-white p-2">
                  <code>@router.post("/items") async def create(data: Item)</code>
                </div>
                <div className="flex items-center justify-between pt-1 text-[11px] text-[#1aae39] font-medium">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-[#1aae39]" /> Dikonfirmasi Kandidat
                  </span>
                  <span>Confidence: 94%</span>
                </div>
              </div>

              {/* Evidence Snippet 2 */}
              <div className="rounded-lg border border-[#e5e3df] bg-[#fafaf9] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="sky">MySQL & SQLAlchemy</Badge>
                  <span className="text-[11px] font-mono text-[#787671]">docker-compose.yml:8</span>
                </div>
                <p className="text-xs text-[#5d5b54]">
                  Definisi container database MySQL 8 dengan persisten volume dan migrasi skema.
                </p>
                <div className="notion-code-block text-[11px] bg-white p-2">
                  <code>image: mysql:8.0 ports: - "3306:3306"</code>
                </div>
                <div className="flex items-center justify-between pt-1 text-[11px] text-[#1aae39] font-medium">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-[#1aae39]" /> Dikonfirmasi Kandidat
                  </span>
                  <span>Confidence: 90%</span>
                </div>
              </div>

              {/* Two-way Decision Status */}
              <div className="rounded-lg border border-[#bbf0cc] bg-[#d9f3e1]/40 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Badge variant="peach">Tech Corp Indonesia</Badge>
                  <span className="text-xs font-semibold text-[#0f5b28] inline-flex items-center gap-1">
                    <Sparkles className="size-3" /> Mutual Match
                  </span>
                </div>
                <h4 className="font-semibold text-xs text-[#1a1a1a]">
                  Backend Engineer - Microservice
                </h4>
                <div className="text-xs text-[#5d5b54] space-y-0.5">
                  <p className="inline-flex items-center gap-1">
                    <Check className="size-3 text-[#1aae39]" /> Kandidat tertarik
                  </p>
                  <br />
                  <p className="inline-flex items-center gap-1">
                    <Check className="size-3 text-[#1aae39]" /> Employer tertarik
                  </p>
                </div>
                <div className="pt-2">
                  <Link to="/workspace">
                    <Button variant="primary" size="sm" className="w-full text-xs h-8">
                      Buka Ruang Diskusi
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Spacer for embedded card breakout */}
      <div className="h-36 sm:h-44 bg-white" />

      {/* Notion 3-Column Pastel Feature Cards */}
      <section className="py-16 px-6 sm:px-12 max-w-7xl mx-auto w-full space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge variant="outline" className="text-xs">
            Alur Kerja Transparan
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-[#1a1a1a]">
            Mengapa JobX Berbeda dari Papan Lowongan Konvensional?
          </h2>
          <p className="text-sm text-[#787671]">
            Menghilangkan klaim palsu di resume dan seleksi berbasis kata kunci statis.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Peach */}
          <Card variant="peach" padding="lg" className="space-y-4">
            <div className="size-11 rounded-lg bg-white/80 flex items-center justify-center text-[#793400] shadow-sm">
              <Search className="size-6" />
            </div>
            <h3 className="font-bold text-lg text-[#1a1a1a]">Evidence Engine Otomatis</h3>
            <p className="text-sm text-[#5d5b54] leading-relaxed">
              Hubungkan repository publik GitHub Anda. Engine JobX secara cerdas membaca README, file
              konfigurasi (Docker, requirements), serta struktur proyek untuk mendeteksi skill nyata
              berserta kutipan lokasinya.
            </p>
            <div className="pt-2">
              <Link
                to="/workspace"
                className="text-xs font-semibold text-[#793400] hover:underline inline-flex items-center gap-1"
              >
                Pelajari cara kerja verifikasi <ArrowRight className="size-3" />
              </Link>
            </div>
          </Card>

          {/* Card 2: Lavender */}
          <Card variant="lavender" padding="lg" className="space-y-4">
            <div className="size-11 rounded-lg bg-white/80 flex items-center justify-center text-[#391c57] shadow-sm">
              <Sparkles className="size-6" />
            </div>
            <h3 className="font-bold text-lg text-[#1a1a1a]">Smart Job Descriptor</h3>
            <p className="text-sm text-[#5d5b54] leading-relaxed">
              Employer cukup memasukkan masalah bisnis dalam bahasa manusia. Gemini 2.5 Flash Lite
              secara otomatis menyusun draft tanggung jawab, ringkasan pekerjaan, dan daftar skill wajib
              yang relevan.
            </p>
            <div className="pt-2">
              <Link
                to="/jobs"
                className="text-xs font-semibold text-[#391c57] hover:underline inline-flex items-center gap-1"
              >
                Coba buat lowongan cerdas <ArrowRight className="size-3" />
              </Link>
            </div>
          </Card>

          {/* Card 3: Mint */}
          <Card variant="mint" padding="lg" className="space-y-4">
            <div className="size-11 rounded-lg bg-white/80 flex items-center justify-center text-[#0f5b28] shadow-sm">
              <Users className="size-6" />
            </div>
            <h3 className="font-bold text-lg text-[#1a1a1a]">Two-Way Mutual Matching</h3>
            <p className="text-sm text-[#5d5b54] leading-relaxed">
              Kandidat dan Employer sama-sama memutuskan. Tidak ada spam tawaran sepihak. Saat kedua
              belah pihak menyatakan tertarik, status berubah menjadi <em>Mutually Accepted</em> dengan
              penjelasan match transparan.
            </p>
            <div className="pt-2">
              <Link
                to="/workspace"
                className="text-xs font-semibold text-[#0f5b28] hover:underline inline-flex items-center gap-1"
              >
                Lihat rekomendasi pekerjaan <ArrowRight className="size-3" />
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* Notion Bold Yellow High-Emphasis Banner (#f9e79f) */}
      <section className="py-12 px-6 sm:px-12 max-w-7xl mx-auto w-full">
        <div className="rounded-xl bg-[#f9e79f] border border-[#f5d75e] p-8 sm:p-12 text-[#37352f] flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-0.5 text-xs font-semibold text-[#4a3900]">
              <Sparkles className="size-3.5" /> Didukung Model Multimodal Terbaru
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1a1a1a]">
              Penilaian Obyektif dengan Gemini 2.5 Flash Lite
            </h3>
            <p className="text-sm sm:text-base text-[#523410] leading-relaxed">
              Model mutakhir dari Google yang mendukung analisis teks, file kode, dan repositori
              dengan latensi kilat dan pemahaman arsitektur mendalam.
            </p>
          </div>
          <div className="shrink-0 flex flex-col sm:flex-row gap-3">
            <Link to="/workspace">
              <Button
                variant="dark"
                size="lg"
                className="bg-[#1a1a1a] hover:bg-black text-white h-11 px-5 rounded-md"
              >
                Mulai Analisis Portofolio
              </Button>
            </Link>
            <Link to="/jobs">
              <Button
                variant="secondary"
                size="lg"
                className="border-[#523410]/40 bg-white/40 text-[#1a1a1a] hover:bg-white/70 h-11 px-5 rounded-md"
              >
                Lihat Katalog Skill
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Callout FAQ / Trust Section */}
      <section className="py-12 px-6 sm:px-12 max-w-4xl mx-auto w-full space-y-4">
        <h3 className="font-semibold text-lg text-[#1a1a1a] mb-2">Panduan Cepat Memulai</h3>
        <Callout
          variant="sky"
          icon={<HelpCircle className="size-5 text-[#0a4a82]" />}
        >
          <strong className="font-semibold text-black">Untuk Kandidat:</strong> Buka menu{' '}
          <Link to="/workspace" className="underline font-medium">
            Workspace Kandidat
          </Link>
          , tambahkan URL repository GitHub Anda, lalu klik "Mulai Analisis AI". Bukti skill akan
          diekstrak dan lowongan yang cocok akan muncul secara otomatis.
        </Callout>
        <Callout
          variant="peach"
          icon={<Building2 className="size-5 text-[#793400]" />}
        >
          <strong className="font-semibold text-black">Untuk Perusahaan (Employer):</strong> Buka{' '}
          <Link to="/jobs" className="underline font-medium">
            Job Studio
          </Link>
          , tulis masalah bisnis yang ingin diselesaikan, klik "Susun Draft dengan AI", lalu terbitkan
          lowongan untuk langsung melihat kandidat yang memiliki bukti kode relevan.
        </Callout>
      </section>
    </div>
  )
}
