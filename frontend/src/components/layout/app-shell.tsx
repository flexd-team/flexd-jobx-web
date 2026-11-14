import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { User, Building2 } from 'lucide-react'
import { useAppSelector } from '@/hooks/use-app-selector'
import { useAppDispatch } from '@/hooks/use-app-dispatch'
import { clearSession, setSession } from '@/redux/slices/auth-slice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import logo from '@/assets/jobx-logo.png'

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const dispatch = useAppDispatch()
  const { token, accountType, user } = useAppSelector((s) => s.auth)

  const navItems = [
    { label: 'Beranda', href: '/' },
    { label: 'Workspace Kandidat', href: '/workspace' },
    { label: 'Job Studio', href: '/jobs' },
    { label: 'Profil', href: '/profile' },
    { label: 'GitHub OAuth', href: '/github' },
  ]

  const handleSimulateCandidate = () => {
    dispatch(
      setSession({
        token: 'dev-token-candidate-2',
        accountType: 'candidate',
        user: {
          id: '2',
          name: 'Ihsan Nul Amri',
          email: 'candidate@example.com',
          account_type: 'candidate',
        },
      }),
    )
  }

  const handleSimulateEmployer = () => {
    dispatch(
      setSession({
        token: 'dev-token-employer-3',
        accountType: 'employer',
        user: {
          id: '3',
          name: 'Tech Talent Recruiter',
          email: 'employer@example.com',
          account_type: 'employer',
        },
      }),
    )
  }

  return (
    <div className="min-h-screen bg-white text-[#37352f] flex flex-col font-sans selection:bg-[#d6b6f6]">
      {/* Top Breadcrumb & Document Bar */}
      <header className="sticky top-0 z-40 border-b border-[#e5e3df] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 py-2.5">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-[#787671]">
            <Link
              to="/"
              className="flex items-center gap-2 font-medium text-[#37352f] hover:opacity-90 transition-opacity"
            >
              <img src={logo} alt="JobX" className="h-7 w-auto object-contain" />
              <span className="sr-only">JobX</span>
            </Link>
            <span className="text-[#a4a097]">/</span>
            <span className="hidden sm:inline font-mono text-xs text-[#5d5b54]">workspace</span>
            {accountType && (
              <>
                <span className="text-[#a4a097]">/</span>
                <Badge
                  variant={accountType === 'candidate' ? 'lavender' : 'peach'}
                  className="font-normal inline-flex items-center gap-1"
                >
                  {accountType === 'candidate' ? (
                    <>
                      <User className="size-3" /> Kandidat
                    </>
                  ) : (
                    <>
                      <Building2 className="size-3" /> Employer
                    </>
                  )}
                </Badge>
              </>
            )}
          </div>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            {navItems.map((item) => {
              const active = location.pathname === item.href
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`rounded-md px-3 py-1.5 transition-colors ${
                    active
                      ? 'bg-[#f6f5f4] text-[#1a1a1a] font-semibold'
                      : 'text-[#5d5b54] hover:bg-[#f6f5f4] hover:text-[#1a1a1a]'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Role status and Simulator / Auth */}
          <div className="flex items-center gap-2">
            {token ? (
              <div className="flex items-center gap-2">
                <span className="hidden lg:inline text-xs text-[#787671] truncate max-w-[140px]">
                  {user?.name || user?.email || 'User'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dispatch(clearSession())}
                  className="text-xs text-[#787671] hover:text-[#e03131]"
                >
                  Keluar
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSimulateCandidate}
                  title="Simulasi login sebagai Kandidat"
                  className="text-xs border-[#d6b6f6] bg-[#fdf9ff] hover:bg-[#e6e0f5] inline-flex items-center gap-1"
                >
                  <User className="size-3.5" /> Kandidat
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSimulateEmployer}
                  title="Simulasi login sebagai Employer"
                  className="text-xs border-[#fed0af] bg-[#fffaf5] hover:bg-[#ffe8d4] inline-flex items-center gap-1"
                >
                  <Building2 className="size-3.5" /> Employer
                </Button>
                <Link to="/account">
                  <Button variant="primary" size="sm" className="text-xs">
                    Masuk
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex overflow-x-auto border-t border-[#ede9e4] px-4 py-1.5 gap-2 text-xs">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`shrink-0 rounded px-2.5 py-1 ${
                location.pathname === item.href
                  ? 'bg-[#f6f5f4] text-black font-semibold'
                  : 'text-[#5d5b54]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1 w-full">
        {children}
      </main>

      {/* Notion Multi-Column Footer */}
      <footer className="border-t border-[#e5e3df] bg-[#fafaf9] py-12 px-6">
        <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold text-base text-[#1a1a1a]">
              <img src={logo} alt="JobX" className="h-6 w-auto object-contain" />
              <span className="sr-only">JobX</span>
            </div>
            <p className="text-xs text-[#787671] leading-relaxed">
              Platform pembuktian skill nyata dan rekrutmen berbasis bukti kode untuk talenta dan
              perusahaan modern.
            </p>
            <div className="pt-2">
              <Badge variant="mint" className="text-[11px]">
                ● Model AI: Gemini 2.5 Flash Lite
              </Badge>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-xs text-[#a4a097] uppercase tracking-wider mb-3">
              Fitur Kandidat
            </h4>
            <ul className="space-y-2 text-xs text-[#5d5b54]">
              <li>
                <Link to="/workspace" className="hover:text-black">
                  Analisis Repository GitHub
                </Link>
              </li>
              <li>
                <Link to="/workspace" className="hover:text-black">
                  Ekstraksi Skill Evidence
                </Link>
              </li>
              <li>
                <Link to="/workspace" className="hover:text-black">
                  Rekomendasi Pekerjaan Otomatis
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-black">
                  Profil & Portofolio
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-xs text-[#a4a097] uppercase tracking-wider mb-3">
              Fitur Employer
            </h4>
            <ul className="space-y-2 text-xs text-[#5d5b54]">
              <li>
                <Link to="/jobs" className="hover:text-black">
                  Smart AI Job Descriptor
                </Link>
              </li>
              <li>
                <Link to="/jobs" className="hover:text-black">
                  Manajemen Lowongan
                </Link>
              </li>
              <li>
                <Link to="/jobs" className="hover:text-black">
                  Two-Way Matching Engine
                </Link>
              </li>
              <li>
                <Link to="/jobs" className="hover:text-black">
                  Inspeksi Bukti Kandidat
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-xs text-[#a4a097] uppercase tracking-wider mb-3">
              Integrasi & Sistem
            </h4>
            <ul className="space-y-2 text-xs text-[#5d5b54]">
              <li>
                <Link to="/github" className="hover:text-black">
                  GitHub OAuth & Sync
                </Link>
              </li>
              <li>
                <span className="text-[#a4a097]">Katalog 20 Canonical Skills</span>
              </li>
              <li>
                <span className="text-[#a4a097]">Sistem Desain Notion (DESIGN.md)</span>
              </li>
              <li>
                <span className="text-[#a4a097]">FastAPI + LangChain + MySQL</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mx-auto max-w-7xl mt-8 pt-6 border-t border-[#ede9e4] flex flex-col sm:flex-row items-center justify-between text-xs text-[#a4a097] gap-3">
          <p>© 2026 JobX by FLEXD. Dibangun sesuai prinsip verifikasi bukti skill dan desain Notion.</p>
          <div className="flex gap-4">
            <span>Privasi</span>
            <span>Ketentuan Layanan</span>
            <span>Dokumentasi API</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
