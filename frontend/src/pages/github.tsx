import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { apiRequest } from '@/lib/api-client'
import { ApiError } from '@/lib/api-error'
import { useAppDispatch } from '@/hooks/use-app-dispatch'
import { useAppSelector } from '@/hooks/use-app-selector'
import { clearSession, setSession } from '@/redux/slices/auth-slice'

const envelope = <T extends z.ZodType>(data: T) => z.object({ data })
const auth = z.object({ access_token: z.string(), token_type: z.string() })
const user = z.object({ account_type: z.string() })
const loginResponse = envelope(z.object({ auth, user }))
const importSchema = z.object({
  repository_id: z.string().min(1, 'Pilih repository'),
  title: z.string().trim().min(1, 'Judul wajib diisi').max(200),
  role_title: z.string().trim().min(1, 'Role wajib diisi').max(150),
  contribution_description: z.string().trim().min(1, 'Kontribusi wajib diisi').max(10000),
})
const passwordSchema = z.object({ email: z.email(), password: z.string().min(1) })
type ImportForm = z.infer<typeof importSchema>
type Repository = { id: string; name: string; owner: string }

export default function GitHubPage() {
  const dispatch = useAppDispatch()
  const { token, accountType } = useAppSelector((state) => state.auth)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [registrationCode, setRegistrationCode] = useState('')
  const [repos, setRepos] = useState<Repository[]>([])
  const [page, setPage] = useState(1)
  const [connected, setConnected] = useState(false)
  const form = useForm<ImportForm>({ resolver: zodResolver(importSchema), defaultValues: {
    repository_id: '', title: '', role_title: '', contribution_description: '',
  } })
  const passwordForm = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema), defaultValues: { email: '', password: '' } })

  useEffect(() => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    if (!code || url.pathname !== '/auth/github/callback') return
    window.history.replaceState({}, '', '/github')
    const exchange = envelope(z.union([
      z.object({ registration_code: z.string() }),
      z.object({ linked: z.boolean() }),
      z.object({ auth, user }),
    ]))
    void apiRequest('/auth/github/exchange', exchange, { method: 'POST', credentials: 'include', body: { code } })
      .then(({ data }) => {
        if ('registration_code' in data) setRegistrationCode(data.registration_code)
        else if ('auth' in data) dispatch(setSession({ token: data.auth.access_token, accountType: data.user.account_type }))
        else setNotice('GitHub berhasil dihubungkan. Login kembali jika sesi tidak tersedia.')
      }).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Pertukaran OAuth gagal.'))
  }, [dispatch])

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('')
    try { await fn() } catch (err) { setError(err instanceof Error ? err.message : 'Permintaan gagal.') } finally { setBusy(false) }
  }
  async function authorize(link = false) {
    await run(async () => {
      const result = await apiRequest(link ? '/integrations/github/authorize' : '/auth/github/authorize',
        envelope(z.object({ authorization_url: z.url() })), { method: 'POST', credentials: 'include', token: token ?? undefined })
      const target = new URL(result.data.authorization_url)
      if (target.origin !== 'https://github.com' || target.pathname !== '/login/oauth/authorize') throw new Error('URL otorisasi tidak valid.')
      window.location.assign(target.href)
    })
  }
  async function register(account_type: 'candidate' | 'employer') {
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await apiRequest('/auth/github/register', loginResponse, {
        method: 'POST', credentials: 'include', body: { code: registrationCode, account_type },
      })
      setRegistrationCode('')
      dispatch(setSession({ token: result.data.auth.access_token, accountType: result.data.user.account_type }))
    } catch (err) {
      // The backend consumes the registration code before attempting registration.
      setRegistrationCode('')
      if (err instanceof ApiError && err.status === 409 && err.fields.email === 'Sign in to link existing account') {
        setError('Email GitHub sudah terdaftar. Login dengan akun JobX yang ada, lalu pilih Hubungkan GitHub. Tidak ada akun yang digabung otomatis.')
      } else if (err instanceof ApiError && err.status === 409 && err.fields.auth === 'GitHub identity already linked') {
        setError('GitHub sudah terhubung. Ulangi login dengan GitHub.')
      } else {
        setError('Registrasi belum berhasil. Ulangi login dengan GitHub atau login dengan akun JobX yang sudah ada.')
      }
    } finally { setBusy(false) }
  }
  async function loadRepositories(targetPage: number) {
    await run(async () => {
      const result = await apiRequest(`/integrations/github/repositories?page=${targetPage}`,
        envelope(z.object({ repositories: z.array(z.object({ id: z.string(), name: z.string(), owner: z.string() })) })), { token: token ?? undefined })
      setRepos(result.data.repositories); setPage(targetPage)
    })
  }
  async function submit(values: ImportForm) {
    const repo = repos.find((item) => item.id === values.repository_id)
    if (!repo) { setError('Pilih repository dari daftar saat ini.'); return }
    await run(async () => {
      await apiRequest('/artifacts/github/import', envelope(z.object({ artifact: z.object({ id: z.string() }) })),
        { method: 'POST', token: token ?? undefined, body: { ...values, repository_name: repo.name } })
      setNotice('Repository berhasil diimpor. Analisis belum dijalankan.'); form.reset()
    })
  }
  const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2'
  const buttonClass = 'rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50'
  return <section className="mx-auto max-w-2xl space-y-6">
    <h1 className="text-3xl font-semibold">GitHub dan artifact</h1>
    <p className="text-muted-foreground">Login atau hubungkan GitHub untuk memilih repository publik milikmu. Sesi berakhir saat halaman dimuat ulang.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {registrationCode ? <div className="space-y-3"><h2 className="text-xl font-semibold">Pilih jenis akun</h2>
      <div className="flex gap-3"><button className={buttonClass} disabled={busy} onClick={() => void register('candidate')}>Kandidat</button>
      <button className={buttonClass} disabled={busy} onClick={() => void register('employer')}>Perusahaan</button></div></div>
      : !token ? <div className="space-y-5"><button className={buttonClass} disabled={busy} onClick={() => void authorize()}>Lanjutkan dengan GitHub</button>
        <form className="space-y-3" onSubmit={passwordForm.handleSubmit((values) => run(async () => {
          const result = await apiRequest('/auth/login', loginResponse, { method: 'POST', body: values })
          passwordForm.reset(); dispatch(setSession({ token: result.data.auth.access_token, accountType: result.data.user.account_type }))
        }))}>
          <h2 className="text-xl font-semibold">Login akun JobX</h2>
          <label className="block space-y-1">Email<input className={inputClass} type="email" autoComplete="email" {...passwordForm.register('email')} /></label>
          {passwordForm.formState.errors.email && <p role="alert">Email tidak valid.</p>}
          <label className="block space-y-1">Password<input className={inputClass} type="password" autoComplete="current-password" {...passwordForm.register('password')} /></label>
          {passwordForm.formState.errors.password && <p role="alert">Password wajib diisi.</p>}
          <button className={buttonClass} disabled={busy}>Login dengan password</button>
        </form></div>
      : <div className="space-y-4"><p>Jenis akun: {accountType}</p>
        <div className="flex flex-wrap gap-3"><button className={buttonClass} disabled={busy} onClick={() => void authorize(true)}>Hubungkan GitHub</button>
        <button className="underline underline-offset-4" onClick={() => { dispatch(clearSession()); setRepos([]); setConnected(false) }}>Hapus sesi lokal</button></div>
        <button className="underline underline-offset-4" disabled={busy} onClick={() => void run(async () => {
          const result = await apiRequest('/integrations/github/connection', envelope(z.object({ connected: z.boolean() })), { token })
          setConnected(result.data.connected); setNotice(result.data.connected ? 'GitHub terhubung.' : 'GitHub belum terhubung.')
        })}>Periksa koneksi</button>
        {connected && <button className="ml-4 underline underline-offset-4" disabled={busy} onClick={() => void run(async () => {
          await apiRequest('/integrations/github/connection', envelope(z.object({})), { method: 'DELETE', token })
          setConnected(false); setRepos([]); setNotice('GitHub diputuskan.')
        })}>Putuskan GitHub</button>}
        {accountType === 'candidate' && <div className="space-y-4"><h2 className="text-xl font-semibold">Impor repository publik</h2>
          <button className={buttonClass} disabled={busy} onClick={() => void loadRepositories(1)}>Muat repository</button>
          {repos.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada repository ditampilkan. Hubungkan GitHub dan muat daftar.</p> :
          <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
            <label className="block space-y-1">Repository<select className={inputClass} {...form.register('repository_id')}><option value="">Pilih repository</option>{repos.map((repo) => <option key={repo.id} value={repo.id}>{repo.owner}/{repo.name}</option>)}</select></label>
            {form.formState.errors.repository_id && <p role="alert">{form.formState.errors.repository_id.message}</p>}
            <label className="block space-y-1">Judul<input className={inputClass} {...form.register('title')} /></label>
            {form.formState.errors.title && <p role="alert">{form.formState.errors.title.message}</p>}
            <label className="block space-y-1">Role<input className={inputClass} {...form.register('role_title')} /></label>
            {form.formState.errors.role_title && <p role="alert">{form.formState.errors.role_title.message}</p>}
            <label className="block space-y-1">Kontribusi<textarea className={inputClass} {...form.register('contribution_description')} /></label>
            {form.formState.errors.contribution_description && <p role="alert">{form.formState.errors.contribution_description.message}</p>}
            <button className={buttonClass} disabled={busy}>Impor artifact</button>
          </form>}
          <div className="flex gap-4"><button disabled={busy || page <= 1} onClick={() => void loadRepositories(page - 1)}>Sebelumnya</button><span>Halaman {page}</span><button disabled={busy || repos.length < 20} onClick={() => void loadRepositories(page + 1)}>Berikutnya</button></div>
        </div>}
      </div>}
  </section>
}
