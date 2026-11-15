import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Lock,
  User,
  Building2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { useAppDispatch } from '@/hooks/use-app-dispatch'
import { useAppSelector } from '@/hooks/use-app-selector'
import { setSession, clearSession } from '@/redux/slices/auth-slice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Callout } from '@/components/ui/callout'
import { apiRequest } from '@/lib/api-client'
import { z } from 'zod'

function GitHubIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  )
}

const authResponseSchema = z.object({
  message: z.record(z.string(), z.string()).optional(),
  error: z.record(z.string(), z.string()).optional(),
  data: z.record(z.string(), z.any()),
})

export default function AccountPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const dispatch = useAppDispatch()
  const { token, accountType, user } = useAppSelector((s) => s.auth)

  const [tab, setTab] = useState<'login' | 'register'>(searchParams.get('mode') === 'register' ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [registerType, setRegisterType] = useState<'candidate' | 'employer'>(searchParams.get('role') === 'employer' ? 'employer' : 'candidate')
  const [loading, setLoading] = useState(false)
  const [githubLoading, setGithubLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      if (errorParam === 'access_denied') {
        setErrorMsg('Otorisasi GitHub dibatalkan oleh pengguna.')
      } else if (errorParam === 'session_expired') {
        setErrorMsg('Sesi otorisasi GitHub telah kedaluwarsa. Silakan ulangi kembali.')
      } else {
        setErrorMsg(`Otorisasi GitHub belum berhasil: ${errorParam}`)
      }
    }
  }, [searchParams])

  const handleGitHubAuth = async () => {
    setGithubLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      const res = await apiRequest(
        '/auth/github/authorize',
        z.object({ data: z.object({ authorization_url: z.string() }) }),
        { method: 'POST', credentials: 'include' },
      )
      const target = new URL(res.data.authorization_url)
      if (target.origin !== 'https://github.com' || target.pathname !== '/login/oauth/authorize') {
        throw new Error('URL otorisasi GitHub tidak valid.')
      }
      window.location.assign(target.href)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memulai otentikasi GitHub.')
      setGithubLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      const res = await apiRequest('api/v1/auth/login', authResponseSchema, {
        method: 'POST',
        body: { email, password },
      })
      const accessToken = res.data?.auth?.access_token
      const userData = res.data?.user
      if (accessToken && userData) {
        dispatch(
          setSession({
            token: accessToken,
            accountType: userData.account_type,
            user: userData,
          }),
        )
        setSuccessMsg(`Selamat datang kembali, ${userData.name}!`)
        setTimeout(() => {
          navigate(`/${userData.account_type === 'admin' ? 'admin' : userData.account_type === 'employer' ? 'employer' : 'candidate'}/overview`)
        }, 800)
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Login gagal. Periksa email dan password Anda.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      const res = await apiRequest('api/v1/auth/register', authResponseSchema, {
        method: 'POST',
        body: {
          name,
          email,
          password,
          account_type: registerType,
        },
      })
      if (res.data?.user) {
        setSuccessMsg('Registrasi berhasil! Silakan masuk dengan akun baru Anda.')
        setTab('login')
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Registrasi gagal. Pastikan email unik dan password minimal 12 karakter.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="py-12 px-4 sm:px-8 max-w-md mx-auto space-y-8">
      {/* Notion Document Header */}
      <div className="text-center space-y-2">
        <div className="size-12 rounded-xl bg-[#e6e0f5] text-[#5645d4] flex items-center justify-center mx-auto">
          <Lock className="size-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1a1a1a]">
          {token ? 'Status Sesi Akun' : 'Masuk ke Workspace JobX'}
        </h1>
        <p className="text-xs text-[#787671]">
          Akses bukti portofolio, matching cerdas, dan deskripsi lowongan AI.
        </p>
      </div>

      {token && user ? (
        <Card variant="default" className="p-6 space-y-4 text-center">
          <Badge
            variant={accountType === 'candidate' ? 'lavender' : 'peach'}
            className="text-xs inline-flex items-center gap-1"
          >
            {accountType === 'candidate' ? (
              <>
                <User className="size-3" /> Kandidat Aktif
              </>
            ) : (
              <>
                <Building2 className="size-3" /> Employer Aktif
              </>
            )}
          </Badge>
          <div>
            <h3 className="font-bold text-lg text-[#1a1a1a]">{user.name}</h3>
            <p className="text-xs text-[#787671]">{user.email}</p>
          </div>
          <p className="text-xs text-[#5d5b54]">
            ID Pengguna: <code>#{user.id}</code>
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/${accountType === 'admin' ? 'admin' : accountType === 'employer' ? 'employer' : 'candidate'}/overview`)}
              className="text-xs"
            >
              Buka {accountType === 'employer' ? 'Job Studio' : 'Workspace'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/github')}
              className="text-xs inline-flex items-center gap-1.5"
            >
              <GitHubIcon className="size-3.5" /> Integrasi GitHub
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => dispatch(clearSession())}
              className="text-xs"
            >
              Keluar Akun
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {errorMsg && (
            <Callout variant="rose" icon={<AlertTriangle className="size-4 text-[#e03131]" />}>
              {errorMsg}
            </Callout>
          )}

          {successMsg && (
            <Callout variant="mint" icon={<CheckCircle2 className="size-4 text-[#1aae39]" />}>
              {successMsg}
            </Callout>
          )}

          {/* Tab Selector */}
          <div className="flex border-b border-[#e5e3df] text-sm">
            <button
              type="button"
              onClick={() => {
                setTab('login')
                setErrorMsg(null)
              }}
              className={`flex-1 pb-2.5 font-medium cursor-pointer transition-colors ${
                tab === 'login'
                  ? 'border-b-2 border-[#1a1a1a] text-[#1a1a1a] font-semibold'
                  : 'text-[#787671] hover:text-[#1a1a1a]'
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register')
                setErrorMsg(null)
              }}
              className={`flex-1 pb-2.5 font-medium cursor-pointer transition-colors ${
                tab === 'register'
                  ? 'border-b-2 border-[#1a1a1a] text-[#1a1a1a] font-semibold'
                  : 'text-[#787671] hover:text-[#1a1a1a]'
              }`}
            >
              Daftar Akun Baru
            </button>
          </div>

          <Card variant="default" className="p-6 space-y-4">
            <Button
              type="button"
              variant="outline"
              disabled={loading || githubLoading}
              onClick={handleGitHubAuth}
              className="w-full text-xs h-10 border-[#1a1a1a]/20 hover:bg-[#f7f6f3] text-[#1a1a1a] font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <GitHubIcon className="size-4" />
              {githubLoading
                ? 'Membuka GitHub...'
                : tab === 'login'
                  ? 'Masuk dengan GitHub'
                  : 'Daftar dengan GitHub'}
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[#e5e3df]" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase">
                <span className="bg-white px-2 text-[#a4a097]">atau dengan email</span>
              </div>
            </div>

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#5d5b54] mb-1">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@perusahaan.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5d5b54] mb-1">Password</label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 12 karakter"
                    required
                  />
                </div>

                <Button type="submit" variant="primary" disabled={loading} className="w-full text-xs h-10">
                  {loading ? 'Memverifikasi...' : 'Masuk'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#5d5b54] mb-1">
                    Nama Lengkap / Perusahaan
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama Lengkap"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5d5b54] mb-1">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@domain.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5d5b54] mb-1">
                    Password (Minimal 12 Karakter)
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 12 karakter"
                    required
                    minLength={12}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5d5b54] mb-1.5">
                    Tipe Akun
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegisterType('candidate')}
                      className={`text-xs p-2.5 rounded-md border cursor-pointer transition-colors inline-flex items-center justify-center gap-1.5 ${
                        registerType === 'candidate'
                          ? 'border-[#5645d4] bg-[#f7f4fc] font-semibold text-[#5645d4]'
                          : 'border-[#c8c4be] bg-white text-[#5d5b54]'
                      }`}
                    >
                      <User className="size-3.5" /> Kandidat
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterType('employer')}
                      className={`text-xs p-2.5 rounded-md border cursor-pointer transition-colors inline-flex items-center justify-center gap-1.5 ${
                        registerType === 'employer'
                          ? 'border-[#5645d4] bg-[#f7f4fc] font-semibold text-[#5645d4]'
                          : 'border-[#c8c4be] bg-white text-[#5d5b54]'
                      }`}
                    >
                      <Building2 className="size-3.5" /> Employer
                    </button>
                  </div>
                </div>

                <Button type="submit" variant="primary" disabled={loading} className="w-full text-xs h-10">
                  {loading ? 'Mendaftarkan...' : 'Daftar Sekarang'}
                </Button>
              </form>
            )}
          </Card>

        </>
      )}
    </div>
  )
}
