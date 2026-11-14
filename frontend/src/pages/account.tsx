import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

const authResponseSchema = z.object({
  message: z.record(z.string(), z.string()).optional(),
  error: z.record(z.string(), z.string()).optional(),
  data: z.record(z.string(), z.any()),
})

export default function AccountPage() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { token, accountType, user } = useAppSelector((s) => s.auth)

  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [registerType, setRegisterType] = useState<'candidate' | 'employer'>('candidate')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

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
          navigate(userData.account_type === 'employer' ? '/jobs' : '/workspace')
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

  // Quick Switcher helpers
  const handleQuickCandidate = () => {
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
    navigate('/workspace')
  }

  const handleQuickEmployer = () => {
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
    navigate('/jobs')
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
              onClick={() => navigate(accountType === 'employer' ? '/jobs' : '/workspace')}
              className="text-xs"
            >
              Buka {accountType === 'employer' ? 'Job Studio' : 'Workspace'}
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

          <Card variant="default" className="p-6">
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

          {/* Quick Demo Switcher */}
          <div className="space-y-3 pt-2">
            <span className="text-xs text-[#a4a097] uppercase tracking-wider block text-center">
              Akses Instan Demo (Mode Pengujian)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleQuickCandidate}
                className="text-xs border-[#d6b6f6] bg-[#fdf9ff] hover:bg-[#e6e0f5] h-9 inline-flex items-center gap-1.5"
              >
                <User className="size-3.5" /> Masuk sbg Kandidat
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleQuickEmployer}
                className="text-xs border-[#fed0af] bg-[#fffaf5] hover:bg-[#ffe8d4] h-9 inline-flex items-center gap-1.5"
              >
                <Building2 className="size-3.5" /> Masuk sbg Employer
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
