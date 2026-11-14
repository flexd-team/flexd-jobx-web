import { ExampleForm } from '@/components/examples/example-form'
import { useAppSelector } from '@/hooks/use-app-selector'
import { Link } from 'react-router-dom'

export default function Home() {
  const workspaceName = useAppSelector((state) => state.app.workspaceName)
  return (
    <div className="grid gap-12 md:grid-cols-[1.15fr_1fr] md:gap-20">
      <section className="space-y-7">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">Fondasi JobX</p>
        <h1 className="display-title text-5xl leading-[1.06] tracking-tight sm:text-6xl">Skill punya bukti.<br /><span className="text-primary">Peluang punya arah.</span></h1>
        <p className="max-w-md text-lg leading-relaxed text-muted-foreground">Workspace awal untuk membangun koneksi antara karya kandidat dan kebutuhan perusahaan.</p>
        <div className="border-l-4 border-primary pl-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Workspace aktif</p>
          <p className="mt-2 break-words font-semibold">{workspaceName}</p>
        </div>
        <Link className="inline-block font-semibold text-primary underline underline-offset-4" to="/github">Login dan impor repository GitHub</Link>
      </section>
      <section aria-labelledby="form-title" className="self-start rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-7 space-y-2">
          <p className="font-mono text-xs text-primary">React Hook Form + Zod + Redux</p>
          <h2 id="form-title" className="text-2xl font-semibold tracking-tight">Atur workspace lokal</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Validasi input dan state aplikasi sudah terhubung. Muat ulang halaman untuk mereset contoh ini.</p>
        </div>
        <ExampleForm />
      </section>
    </div>
  )
}
