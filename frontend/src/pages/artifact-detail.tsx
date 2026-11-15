import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ExternalLink, RefreshCw, Sparkles } from 'lucide-react'
import { z } from 'zod'
import { artifactDetail, envelope } from '@/schemas/portal'
import { usePortalResource } from '@/hooks/use-portal-resource'
import { useAppSelector } from '@/hooks/use-app-selector'
import { ArtifactEditor } from '@/components/artifact-editor'
import { PageHeading, ResourceState, StatusBadge } from '@/components/portal-ui'
import { artifactTypeLabels, visibilityLabels } from '@/lib/portal-labels'
import { apiRequest } from '@/lib/api-client'
import { downloadArtifact } from '@/lib/artifact-files'
import { EvidencePage } from '@/pages/portal'

const queued = envelope(z.object({ artifact_analysis: z.object({ id: z.string(), analysis_status: z.string() }) }))

export default function ArtifactDetailPage() {
  const { artifactId = '' } = useParams()
  const resource = usePortalResource(`/my/artifacts/${artifactId}`, artifactDetail)
  const token = useAppSelector((s) => s.auth.token)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const item = resource.data?.data.artifact
  const contribution = resource.data?.data.artifact_contribution
  const analysis = resource.data?.data.artifact_analysis
  return <><Link className="jx-button" to="/candidate/artifacts">Kembali ke artifacts</Link><div style={{ marginTop: 24 }}><ResourceState {...resource} retry={resource.reload}/></div>{item && <>
    <PageHeading title={item.title} description="Detail karya, konteks kontribusi, dan hasil skill evidence yang bisa ditinjau."><ArtifactEditor item={item} reload={resource.reload}/><button className="jx-button" onClick={resource.reload}><RefreshCw size={14}/>Perbarui</button><button className="jx-button primary" disabled={busy || ['queued', 'processing'].includes(item.processing_status)} onClick={async () => {
      if (!window.confirm('Kirim konten artifact ke model AI yang dikonfigurasi? Pastikan konten boleh dibagikan dan tidak mengandung secret.')) return
      setBusy(true); setError('')
      try { await apiRequest(`/artifacts/${item.id}/analyze`, queued, { method: 'POST', token: token! }); resource.reload() } catch (err) { setError(err instanceof Error ? err.message : 'Analisis gagal dimulai.') } finally { setBusy(false) }
    }}><Sparkles size={14}/>{busy ? 'Mengantrekan…' : 'Analisis'}</button></PageHeading>
    {error && <div className="jx-notice error" role="alert">{error}</div>}
    <div className="jx-detail-layout"><section className="jx-record"><h2>Tentang karya</h2><p className="jx-detail-description">{item.description || 'Belum ada deskripsi karya.'}</p><h3>Kontribusi pribadi</h3>{contribution ? <><p><strong>{contribution.role_title || 'Peran belum diisi'}</strong></p><p className="jx-detail-description">{contribution.contribution_description}</p><StatusBadge value={contribution.claim_status}/></> : <p>Belum ada klaim kontribusi. Tambahkan melalui Edit artifact.</p>}</section><aside className="jx-record"><dl className="jx-detail-meta"><div><dt>Jenis karya</dt><dd>{artifactTypeLabels[item.artifact_type] || item.artifact_type}</dd></div><div><dt>Visibilitas</dt><dd>{visibilityLabels[item.visibility] || item.visibility}</dd></div><div><dt>Status pemrosesan</dt><dd><StatusBadge value={item.processing_status}/></dd></div></dl>{item.source_url && /^https?:\/\//.test(item.source_url) && <div className="jx-actions"><a className="jx-button" href={item.source_url} target="_blank" rel="noopener noreferrer">Buka sumber<ExternalLink size={13}/></a></div>}</aside></div>
    <section className="jx-record" style={{ marginBottom: 32 }}><h2>Hasil analisis terbaru</h2>{analysis ? <><StatusBadge value={analysis.analysis_status}/><p className="jx-detail-description">{analysis.extracted_summary || analysis.error_message || 'Analisis belum menghasilkan ringkasan. Gunakan Perbarui untuk memeriksa status.'}</p></> : <p>Belum ada analisis. Jalankan analisis untuk menghasilkan saran skill evidence.</p>}</section>
    {item.storage_key?.startsWith('local/') && <section className="jx-record" style={{marginBottom: 24}}><h2>File karya</h2><p>{item.mime_type || 'File tersimpan'}. Download membutuhkan sesi pemilik artifact.</p><button type="button" className="jx-button" disabled={busy} onClick={async () => {setBusy(true);setError('');try {await downloadArtifact(item.id, token!, `${item.title}.${({ 'application/pdf':'pdf', 'text/plain':'txt', 'text/csv':'csv', 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp', 'video/mp4':'mp4', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx' } as Record<string,string>)[item.mime_type || ''] || 'bin'}`)} catch(err) {setError(err instanceof Error ? err.message : 'Download gagal.')} finally {setBusy(false)}}}>Unduh file</button><p className="jx-muted">Pilih Analisis untuk mengirim konten ke model. PDF/gambar/video memakai multimodal; DOCX/spreadsheet/TXT memakai teks dan sel. Observasi visual serta timestamp video tetap perlu ditinjau manusia.</p></section>}
    <EvidencePage key={item.id} artifactId={item.id}/>
  </>}</>
}
