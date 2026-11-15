import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/ui/modal'
import { artifact, envelope } from '@/schemas/portal'
import { artifactTypeLabels, visibilityLabels } from '@/lib/portal-labels'
import { artifactFileFormats, defaultUploadLimit } from '@/lib/artifact-files'
import { apiRequest } from '@/lib/api-client'
import { useAppSelector } from '@/hooks/use-app-selector'

const schema = z.object({ title: z.string().trim().min(1, 'Judul wajib diisi.').max(200), description: z.string().max(10000), artifact_type: z.enum(['document', 'spreadsheet', 'image', 'video']), visibility: z.enum(['private', 'unlisted', 'matching_employers', 'public']) })

export function ArtifactCreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const token = useAppSelector((s) => s.auth.token)
  const [file, setFile] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { title: '', description: '', artifact_type: 'document', visibility: 'private' } })
  const kind = form.watch('artifact_type')
  const formats = artifactFileFormats[kind]
  function choose(selected: File | null) {
    setError(''); setFile(null)
    if (!selected) return
    if (!formats.includes(selected.name.split('.').at(-1)?.toLowerCase() || '')) { setError('Format file tidak sesuai jenis karya.'); return }
    if (!selected.size || selected.size > defaultUploadLimit) { setError('Pilih file tidak kosong, maksimal 20 MB.'); return }
    setFile(selected)
    if (!form.getValues('title')) form.setValue('title', selected.name.replace(/\.[^.]+$/, ''), { shouldDirty: true })
  }
  return <Modal title="Tambah artifact" onClose={onClose} dirty={form.formState.isDirty || !!file} busy={form.formState.isSubmitting}>
    <form onSubmit={form.handleSubmit(async (values) => {
      setError('')
      if (!file) { setError('Pilih file karya terlebih dahulu.'); return }
      const params = new URLSearchParams({ ...values, filename: file.name })
      try { await apiRequest(`/my/artifacts/upload?${params}`, envelope(z.object({ artifact })), { method: 'POST', token: token!, rawBody: file, headers: { 'Content-Type': file.type || 'application/octet-stream' }, signal: AbortSignal.timeout(120000) }); onSaved(); onClose() }
      catch (err) { setError(err instanceof Error ? err.message : 'Upload gagal. Coba lagi.') }
    })}>
      <fieldset className="jx-form-grid" disabled={form.formState.isSubmitting}>
        <label className="jx-field">Jenis karya<select className="jx-input" {...form.register('artifact_type', { onChange: () => { setFile(null); setError('') } })}>{schema.shape.artifact_type.options.map((value) => <option key={value} value={value}>{artifactTypeLabels[value]}</option>)}</select></label>
        <label className="jx-field">Visibilitas<select className="jx-input" {...form.register('visibility')}>{schema.shape.visibility.options.map((value) => <option key={value} value={value}>{visibilityLabels[value]}</option>)}</select></label>
        <div className="jx-field full"><label htmlFor="artifact-upload">File karya</label><div className="jx-upload-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!form.formState.isSubmitting) choose(event.dataTransfer.files[0] ?? null) }}><input ref={fileInput} hidden key={kind} id="artifact-upload" type="file" accept={formats.map((value) => `.${value}`).join(',')} onChange={(event) => { choose(event.target.files?.[0] ?? null); event.target.value = '' }}/><button type="button" className="jx-button" onClick={() => fileInput.current?.click()}>Choose File</button><span className="jx-upload-filename" role="status">{file?.name || 'No file chosen'}</span><p>Tarik file ke sini atau pilih file.</p><small>{formats.map((value) => value.toUpperCase()).join(', ')} · maksimal 20 MB</small></div>{file && <div className="jx-notice"><span>{file.name} · {(file.size / 1_000_000).toFixed(2)} MB</span><button type="button" className="jx-button" onClick={() => setFile(null)}>Hapus file</button></div>}</div>
        <label className="jx-field full">Judul<input className="jx-input" {...form.register('title')}/></label>
        <label className="jx-field full">Deskripsi karya<textarea className="jx-input" {...form.register('description')}/></label>
      </fieldset>
      <p className="jx-muted">File disimpan privat. Setelah upload, pilih Analisis untuk mengirim konten ke model yang dikonfigurasi. PDF/gambar/video memakai multimodal; DOCX/spreadsheet/TXT memakai ekstraksi teks dan sel. Jangan kirim secret atau data tanpa izin.</p>
      {Object.values(form.formState.errors).map((value, index) => <p role="alert" key={index}>{value.message}</p>)}
      {error && <div className="jx-notice error" role="alert">{error}</div>}
      <div className="jx-actions"><button className="jx-button primary" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Mengupload…' : 'Simpan artifact'}</button></div>
    </form>
  </Modal>
}
