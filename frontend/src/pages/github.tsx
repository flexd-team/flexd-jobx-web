import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  GitBranch,
  FolderGit2,
  CheckCircle2,
  AlertTriangle,
  User,
  Building2,
  LogOut,
  RefreshCw,
} from 'lucide-react'
import { apiRequest } from '@/lib/api-client'
import { ApiError } from '@/lib/api-error'
import { useAppDispatch } from '@/hooks/use-app-dispatch'
import { useAppSelector } from '@/hooks/use-app-selector'
import { clearSession, setSession } from '@/redux/slices/auth-slice'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

function safeNavigate(path: string) {
  try {
    window.location.assign(path)
  } catch {
    window.location.href = path
  }
}

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

const envelope = <T extends z.ZodType>(data: T) => z.object({ data })
const auth = z.object({ access_token: z.string(), token_type: z.string() })
const user = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  account_type: z.string(),
})
const loginResponse = envelope(z.object({ auth, user }))
const importSchema = z.object({
  repository_id: z.string().min(1, 'Pilih repository'),
  title: z.string().trim().min(1, 'Judul wajib diisi').max(200),
  role_title: z.string().trim().min(1, 'Role wajib diisi').max(150),
  contribution_description: z.string().trim().min(1, 'Kontribusi wajib diisi').max(10000),
})
const passwordSchema = z.object({ email: z.string().email(), password: z.string().min(1) })
type ImportForm = z.infer<typeof importSchema>
type Repository = { id: string; name: string; owner: string }

export default function GitHubPage() {
  const dispatch = useAppDispatch()
  const { token, accountType, user: currentUser } = useAppSelector((state) => state.auth)
  const hasExchangedRef = useRef(false)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [registrationCode, setRegistrationCode] = useState('')
  const [repos, setRepos] = useState<Repository[]>([])
  const [page, setPage] = useState(1)
  const [connected, setConnected] = useState(false)
  const [checking, setChecking] = useState(false)

  const checkConnection = useCallback(
    async (showNotice = false) => {
      if (!token) return
      setChecking(true)
      try {
        const result = await apiRequest(
          '/integrations/github/connection',
          envelope(z.object({ connected: z.boolean() })),
          { token },
        )
        setConnected(result.data.connected)
        if (showNotice) {
          setNotice(
            result.data.connected
              ? 'GitHub terhubung ke akun Anda.'
              : 'GitHub belum terhubung ke akun Anda.',
          )
        }
      } catch {
        // Silently catch on initial load
      } finally {
        setChecking(false)
      }
    },
    [token],
  )

  useEffect(() => {
    if (token) {
      void checkConnection(false)
    } else {
      setConnected(false)
    }
  }, [token, checkConnection])

  const form = useForm<ImportForm>({
    resolver: zodResolver(importSchema),
    defaultValues: {
      repository_id: '',
      title: '',
      role_title: '',
      contribution_description: '',
    },
  })
  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    const url = new URL(window.location.href)
    const errorParam = url.searchParams.get('error')
    const errorDesc = url.searchParams.get('error_description')

    if (errorParam) {
      window.history.replaceState({}, '', '/github')
      if (errorParam === 'access_denied') {
        setError('Otorisasi GitHub dibatalkan oleh pengguna.')
      } else if (errorParam === 'session_expired') {
        setError('Sesi otorisasi GitHub telah kedaluwarsa. Silakan ulangi kembali.')
      } else {
        setError(`Otorisasi GitHub gagal: ${errorDesc || errorParam}`)
      }
      return
    }

    const code = url.searchParams.get('code')
    if (!code || url.pathname !== '/auth/github/callback') return
    if (hasExchangedRef.current) return
    hasExchangedRef.current = true

    window.history.replaceState({}, '', '/github')
    const exchange = envelope(
      z.union([
        z.object({ registration_code: z.string() }),
        z.object({ linked: z.boolean() }),
        z.object({ auth, user }),
      ]),
    )

    void apiRequest('/auth/github/exchange', exchange, {
      method: 'POST',
      credentials: 'include',
      body: { code },
    })
      .then(({ data }) => {
        if ('registration_code' in data) {
          setRegistrationCode(data.registration_code)
          setNotice('GitHub berhasil diverifikasi. Silakan pilih jenis akun untuk menyelesaikan registrasi.')
        } else if ('auth' in data) {
          const userData = {
            id: data.user.id || '',
            name: data.user.name || 'Pengguna GitHub',
            email: data.user.email || '',
            account_type: data.user.account_type,
          }
          dispatch(
            setSession({
              token: data.auth.access_token,
              accountType: data.user.account_type,
              user: userData,
            }),
          )
          setNotice(`Selamat datang kembali, ${userData.name}! Login berhasil. Mengalihkan...`)
          setTimeout(() => {
            safeNavigate(userData.account_type === 'employer' ? '/jobs' : '/workspace')
          }, 800)
        } else {
          setNotice('GitHub berhasil dihubungkan dengan akun JobX Anda.')
          setConnected(true)
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Pertukaran OAuth gagal.')
      })
  }, [dispatch])

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Permintaan gagal.')
    } finally {
      setBusy(false)
    }
  }

  async function authorize(link = false) {
    await run(async () => {
      const result = await apiRequest(
        link ? '/integrations/github/authorize' : '/auth/github/authorize',
        envelope(z.object({ authorization_url: z.string() })),
        { method: 'POST', credentials: 'include', token: token ?? undefined },
      )
      const target = new URL(result.data.authorization_url)
      if (target.origin !== 'https://github.com' || target.pathname !== '/login/oauth/authorize') {
        throw new Error('URL otorisasi tidak valid.')
      }
      window.location.assign(target.href)
    })
  }

  async function register(account_type: 'candidate' | 'employer') {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest('/auth/github/register', loginResponse, {
        method: 'POST',
        credentials: 'include',
        body: { code: registrationCode, account_type },
      })
      setRegistrationCode('')
      const userData = {
        id: result.data.user.id || '',
        name: result.data.user.name || 'Pengguna GitHub',
        email: result.data.user.email || '',
        account_type: result.data.user.account_type,
      }
      dispatch(
        setSession({
          token: result.data.auth.access_token,
          accountType: result.data.user.account_type,
          user: userData,
        }),
      )
      setNotice(`Registrasi berhasil sebagai ${account_type === 'candidate' ? 'Kandidat' : 'Perusahaan'}! Mengalihkan...`)
      setTimeout(() => {
        safeNavigate(account_type === 'employer' ? '/jobs' : '/workspace')
      }, 800)
    } catch (err) {
      // The backend consumes the registration code before attempting registration.
      setRegistrationCode('')
      if (
        err instanceof ApiError &&
        err.status === 409 &&
        err.fields.email === 'Sign in to link existing account'
      ) {
        setError(
          'Email GitHub sudah terdaftar. Login dengan akun JobX yang ada, lalu pilih Hubungkan GitHub. Tidak ada akun yang digabung otomatis.',
        )
      } else if (
        err instanceof ApiError &&
        err.status === 409 &&
        err.fields.auth === 'GitHub identity already linked'
      ) {
        setError('GitHub sudah terhubung. Ulangi login dengan GitHub.')
      } else {
        setError('Registrasi belum berhasil. Ulangi login dengan GitHub atau login dengan akun JobX yang sudah ada.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function loadRepositories(targetPage: number) {
    await run(async () => {
      const result = await apiRequest(
        `/integrations/github/repositories?page=${targetPage}`,
        envelope(
          z.object({
            repositories: z.array(
              z.object({ id: z.string(), name: z.string(), owner: z.string() }),
            ),
          }),
        ),
        { token: token ?? undefined },
      )
      setRepos(result.data.repositories)
      setPage(targetPage)
    })
  }

  async function submit(values: ImportForm) {
    const repo = repos.find((item) => item.id === values.repository_id)
    if (!repo) {
      setError('Pilih repository dari daftar saat ini.')
      return
    }
    await run(async () => {
      await apiRequest(
        '/artifacts/github/import',
        envelope(z.object({ artifact: z.object({ id: z.string() }) })),
        {
          method: 'POST',
          token: token ?? undefined,
          body: { ...values, repository_name: repo.name },
        },
      )
      setNotice('Repository berhasil diimpor sebagai artifact. Analisis AI dapat dijalankan di Workspace Kandidat.')
      form.reset()
    })
  }

  return (
    <div className="py-10 px-4 sm:px-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="size-12 rounded-xl bg-[#e6e0f5] text-[#5645d4] flex items-center justify-center mx-auto shadow-sm">
          <GitHubIcon className="size-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1a1a1a]">
          GitHub OAuth & Artifact Import
        </h1>
        <p className="text-xs sm:text-sm text-[#787671] max-w-lg mx-auto">
          Hubungkan akun GitHub Anda untuk otentikasi sekali klik dan impor repositori publik sebagai bukti keahlian terverifikasi.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div role="alert" className="p-4 rounded-lg bg-[#ffebe9] border border-[#ffc1ba] text-xs text-[#d12420] flex items-start gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div role="status" className="p-4 rounded-lg bg-[#eefaf0] border border-[#c4eecb] text-xs text-[#1a7f37] flex items-start gap-2">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {/* Flow 1: Registration Code Present -> Select Account Role */}
      {registrationCode ? (
        <Card variant="default" className="p-6 space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold text-[#1a1a1a]">Pilih Jenis Akun JobX</h2>
            <p className="text-xs text-[#787671]">
              Identitas GitHub Anda telah terverifikasi. Pilih peran akun untuk menyelesaikan pembuatan profil:
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-lg border border-[#e5e3df] hover:border-[#5645d4] bg-[#faf8ff] space-y-3 transition-colors flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="size-8 rounded-lg bg-[#e6e0f5] text-[#5645d4] flex items-center justify-center">
                  <User className="size-4" />
                </div>
                <h3 className="font-bold text-sm text-[#1a1a1a]">Kandidat Talenta</h3>
                <p className="text-xs text-[#787671]">
                  Unggah portofolio GitHub, dapatkan bukti skill AI, dan terima rekomendasi pekerjaan presisi.
                </p>
              </div>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => void register('candidate')}
                className="w-full text-xs h-9 cursor-pointer"
              >
                Kandidat
              </Button>
            </div>

            <div className="p-4 rounded-lg border border-[#e5e3df] hover:border-[#5645d4] bg-[#fffaf5] space-y-3 transition-colors flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="size-8 rounded-lg bg-[#ffe8d4] text-[#d96704] flex items-center justify-center">
                  <Building2 className="size-4" />
                </div>
                <h3 className="font-bold text-sm text-[#1a1a1a]">Perusahaan / Employer</h3>
                <p className="text-xs text-[#787671]">
                  Publikasikan lowongan kerja, generate deskripsi cerdas, dan temukan kandidat berbakat.
                </p>
              </div>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void register('employer')}
                className="w-full text-xs h-9 border-[#d96704]/30 hover:bg-[#ffe8d4]/40 text-[#9c4500] font-semibold cursor-pointer"
              >
                Perusahaan
              </Button>
            </div>
          </div>
        </Card>
      ) : !token ? (
        /* Flow 2: Not Logged In -> Authorize with GitHub or Standard Login */
        <Card variant="default" className="p-6 space-y-5">
          <div className="space-y-3">
            <h2 className="text-base font-bold text-[#1a1a1a]">Masuk atau Daftar dengan GitHub</h2>
            <p className="text-xs text-[#787671]">
              Gunakan akun GitHub untuk masuk langsung atau mendaftar otomatis tanpa perlu mengingat password tambahan.
            </p>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void authorize()}
              className="w-full text-xs h-10 border-[#1a1a1a]/20 hover:bg-[#f7f6f3] text-[#1a1a1a] font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <GitHubIcon className="size-4" />
              {busy ? 'Mempersiapkan...' : 'Lanjutkan dengan GitHub'}
            </Button>
          </div>

          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#e5e3df]" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-white px-2 text-[#a4a097]">atau login akun JobX</span>
            </div>
          </div>

          <form
            className="space-y-3"
            onSubmit={passwordForm.handleSubmit((values) =>
              run(async () => {
                const result = await apiRequest('/auth/login', loginResponse, {
                  method: 'POST',
                  body: values,
                })
                passwordForm.reset()
                const userData = {
                  id: result.data.user.id || '',
                  name: result.data.user.name || 'Pengguna JobX',
                  email: result.data.user.email || '',
                  account_type: result.data.user.account_type,
                }
                dispatch(
                  setSession({
                    token: result.data.auth.access_token,
                    accountType: result.data.user.account_type,
                    user: userData,
                  }),
                )
                safeNavigate(userData.account_type === 'employer' ? '/jobs' : '/workspace')
              }),
            )}
          >
            <div>
              <label className="block text-xs font-medium text-[#5d5b54] mb-1">Email</label>
              <Input
                type="email"
                autoComplete="email"
                placeholder="email@example.com"
                {...passwordForm.register('email')}
              />
              {passwordForm.formState.errors.email && (
                <p role="alert" className="text-xs text-[#d12420] mt-1">
                  Email tidak valid.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5d5b54] mb-1">Password</label>
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="Password JobX Anda"
                {...passwordForm.register('password')}
              />
              {passwordForm.formState.errors.password && (
                <p role="alert" className="text-xs text-[#d12420] mt-1">
                  Password wajib diisi.
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="secondary"
              disabled={busy}
              className="w-full text-xs h-9 cursor-pointer"
            >
              Login dengan password
            </Button>
          </form>
        </Card>
      ) : (
        /* Flow 3: Logged In -> Connection Status, Unlink & Repo Importer */
        <div className="space-y-6">
          <Card variant="default" className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5e3df]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-[#1a1a1a]">
                    {currentUser?.name || 'Pengguna JobX'}
                  </h3>
                  <Badge variant={accountType === 'candidate' ? 'lavender' : 'peach'} className="text-[10px]">
                    {accountType === 'candidate' ? 'Kandidat' : 'Employer'}
                  </Badge>
                </div>
                <p className="text-xs text-[#787671]">{currentUser?.email}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || checking}
                  onClick={() => void checkConnection(true)}
                  className="text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`size-3 ${checking ? 'animate-spin' : ''}`} />
                  {checking ? 'Memeriksa...' : 'Periksa koneksi'}
                </Button>

                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    dispatch(clearSession())
                    setRepos([])
                    setConnected(false)
                    safeNavigate('/account')
                  }}
                  className="text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="size-3" /> Hapus sesi lokal
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#5d5b54]">Status GitHub:</span>
                <Badge variant={connected ? 'mint' : 'outline'} className="text-xs">
                  {connected ? 'Terhubung' : 'Belum Terhubung'}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                {connected ? (
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await apiRequest('/integrations/github/connection', envelope(z.object({})), {
                          method: 'DELETE',
                          token,
                        })
                        setConnected(false)
                        setRepos([])
                        setNotice('Integrasi GitHub berhasil diputuskan.')
                      })
                    }
                    className="text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    Putuskan GitHub
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={busy}
                    onClick={() => void authorize(true)}
                    className="text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <GitHubIcon className="size-3.5" /> Hubungkan GitHub
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Candidate-only Public Repository Importer */}
          {accountType === 'candidate' && (
            <Card variant="default" className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-[#1a1a1a]">Impor Repositori Publik</h3>
                  <p className="text-xs text-[#787671]">
                    Pilih repositori open-source milik Anda untuk dianalisis oleh AI menjadi bukti skill.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void loadRepositories(1)}
                  className="text-xs inline-flex items-center gap-1.5"
                >
                  <FolderGit2 className="size-3.5" /> Muat Repositori
                </Button>
              </div>

              {repos.length === 0 ? (
                <div className="p-6 rounded-lg bg-[#faf8ff] border border-dashed border-[#d6b6f6] text-center space-y-2">
                  <GitBranch className="size-6 text-[#5645d4] mx-auto" />
                  <p className="text-xs text-[#5d5b54]">
                    Belum ada repositori ditampilkan. Pastikan GitHub sudah terhubung dan klik <strong>Muat Repositori</strong>.
                  </p>
                </div>
              ) : (
                <form className="space-y-4 pt-2" onSubmit={form.handleSubmit(submit)}>
                  <div>
                    <label className="block text-xs font-medium text-[#5d5b54] mb-1">
                      Pilih Repositori
                    </label>
                    <select
                      className="w-full text-xs rounded-md border border-[#c8c4be] bg-white px-3 py-2 text-[#1a1a1a] focus:outline-none focus:ring-1 focus:ring-[#5645d4]"
                      {...form.register('repository_id')}
                    >
                      <option value="">-- Pilih repositori yang akan diimpor --</option>
                      {repos.map((repo) => (
                        <option key={repo.id} value={repo.id}>
                          {repo.owner}/{repo.name}
                        </option>
                      ))}
                    </select>
                    {form.formState.errors.repository_id && (
                      <p role="alert" className="text-xs text-[#d12420] mt-1">
                        {form.formState.errors.repository_id.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#5d5b54] mb-1">
                      Judul Portfolio / Proyek
                    </label>
                    <Input
                      placeholder="Contoh: Sistem E-Commerce Microservices"
                      {...form.register('title')}
                    />
                    {form.formState.errors.title && (
                      <p role="alert" className="text-xs text-[#d12420] mt-1">
                        {form.formState.errors.title.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#5d5b54] mb-1">
                      Peran Anda dalam Proyek
                    </label>
                    <Input
                      placeholder="Contoh: Lead Backend Developer / Author"
                      {...form.register('role_title')}
                    />
                    {form.formState.errors.role_title && (
                      <p role="alert" className="text-xs text-[#d12420] mt-1">
                        {form.formState.errors.role_title.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#5d5b54] mb-1">
                      Deskripsi Kontribusi Spesifik
                    </label>
                    <textarea
                      rows={3}
                      className="w-full text-xs rounded-md border border-[#c8c4be] bg-white px-3 py-2 text-[#1a1a1a] focus:outline-none focus:ring-1 focus:ring-[#5645d4]"
                      placeholder="Jelaskan modul atau fitur yang Anda kembangkan, arsitektur, dan teknologi yang digunakan..."
                      {...form.register('contribution_description')}
                    />
                    {form.formState.errors.contribution_description && (
                      <p role="alert" className="text-xs text-[#d12420] mt-1">
                        {form.formState.errors.contribution_description.message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 text-xs text-[#787671]">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy || page <= 1}
                        onClick={() => void loadRepositories(page - 1)}
                        className="text-xs h-8"
                      >
                        Sebelumnya
                      </Button>
                      <span>Halaman {page}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy || repos.length < 20}
                        onClick={() => void loadRepositories(page + 1)}
                        className="text-xs h-8"
                      >
                        Berikutnya
                      </Button>
                    </div>

                    <Button type="submit" variant="primary" disabled={busy} className="text-xs h-9 cursor-pointer">
                      {busy ? 'Mengimpor...' : 'Impor artifact'}
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
