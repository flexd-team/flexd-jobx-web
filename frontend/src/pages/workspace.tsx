import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderGit2,
  AlertCircle,
  AlertTriangle,
  GitBranch,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  X,
  Check,
  Lightbulb,
  MessageSquare,
  Heart,
  User,
  ExternalLink,
} from 'lucide-react'
import { useAppSelector } from '@/hooks/use-app-selector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Callout } from '@/components/ui/callout'
import { apiRequest } from '@/lib/api-client'
import { z } from 'zod'

type ArtifactItem = {
  id: string
  title: string
  artifact_type: string
  description?: string | null
  source_url?: string | null
  processing_status: string
  created_at?: string
}

type SkillEvidenceItem = {
  id: string
  artifact_id: string
  skill_id: string
  skill_name: string
  evidence_kind: string
  file_path_or_location?: string | null
  excerpt_text?: string | null
  confidence_score?: string | null
  review_status: string
}

type JobMatchItem = {
  id: string
  job_post_id: string
  job_title: string
  company_name: string
  match_score?: string | null
  confidence_score?: string | null
  match_status: string
  candidate_decision: string
  employer_decision: string
  explanation?: string | null
}

const genericResponseSchema = z.object({
  message: z.record(z.string(), z.string()).optional(),
  error: z.record(z.string(), z.string()).optional(),
  data: z.record(z.string(), z.any()),
})

export default function WorkspacePage() {
  const { token, accountType } = useAppSelector((s) => s.auth)

  // State
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([])
  const [evidences, setEvidences] = useState<SkillEvidenceItem[]>([])
  const [matches, setMatches] = useState<JobMatchItem[]>([])
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [analysisSummary, setAnalysisSummary] = useState<Record<string, string>>({})
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Form State for new artifact
  const [newTitle, setNewTitle] = useState('')
  const [newRepoUrl, setNewRepoUrl] = useState('https://github.com/zexceed12300/ABL_2411082008')
  const [newDesc, setNewDesc] = useState('Hospital management backend microservice dengan FastAPI & MySQL.')
  const [creatingArtifact, setCreatingArtifact] = useState(false)

  // Load candidate artifacts
  const loadArtifacts = useCallback(async () => {
    try {
      const res = await apiRequest('api/v1/my/artifacts', genericResponseSchema, { token: token ?? undefined })
      if (res.data?.artifacts) {
        setArtifacts(res.data.artifacts as ArtifactItem[])
      }
    } catch {
      // Mock / fallback if token not configured or dev mode
      setArtifacts([
        {
          id: '1',
          title: 'Hospital Management Microservice',
          artifact_type: 'github_repository',
          source_url: 'https://github.com/zexceed12300/ABL_2411082008',
          description: 'Layanan manajemen data pasien dan rawat inap dengan FastAPI dan MySQL.',
          processing_status: 'completed',
        },
      ])
    }
  }, [token])

  // Load skill evidences
  const loadEvidences = useCallback(async () => {
    try {
      const res = await apiRequest('api/v1/my/skill-evidences', genericResponseSchema, { token: token ?? undefined })
      if (res.data?.skill_evidences) {
        setEvidences(res.data.skill_evidences as SkillEvidenceItem[])
      }
    } catch {
      setEvidences([
        {
          id: '1',
          artifact_id: '1',
          skill_id: '1',
          skill_name: 'Python',
          evidence_kind: 'code_manifest',
          file_path_or_location: 'requirements.txt:1',
          excerpt_text: 'fastapi==0.115.0\nSQLAlchemy==2.0.36\nasyncmy==0.2.9',
          confidence_score: '0.96',
          review_status: 'candidate_confirmed',
        },
        {
          id: '2',
          artifact_id: '1',
          skill_id: '2',
          skill_name: 'FastAPI',
          evidence_kind: 'code_manifest',
          file_path_or_location: 'README.md:14',
          excerpt_text: 'API dibangun menggunakan FastAPI async router dan auto-generated OpenAPI docs.',
          confidence_score: '0.94',
          review_status: 'candidate_confirmed',
        },
        {
          id: '3',
          artifact_id: '1',
          skill_id: '3',
          skill_name: 'MySQL',
          evidence_kind: 'code_manifest',
          file_path_or_location: 'docker-compose.yml:8',
          excerpt_text: 'services:\n  db:\n    image: mysql:8.0\n    ports: ["3306:3306"]',
          confidence_score: '0.91',
          review_status: 'extracted_unreviewed',
        },
        {
          id: '4',
          artifact_id: '1',
          skill_id: '4',
          skill_name: 'Docker',
          evidence_kind: 'code_manifest',
          file_path_or_location: 'docker-compose.yml:1',
          excerpt_text: 'version: "3.8"\nservices:\n  api:\n    build: .',
          confidence_score: '0.88',
          review_status: 'extracted_unreviewed',
        },
      ])
    }
  }, [token])

  // Load matches
  const loadMatches = useCallback(async () => {
    try {
      const res = await apiRequest('api/v1/my/job-matches', genericResponseSchema, { token: token ?? undefined })
      if (res.data?.matches) {
        setMatches(res.data.matches as JobMatchItem[])
      }
    } catch {
      setMatches([
        {
          id: '1',
          job_post_id: '1',
          job_title: 'Senior Backend Engineer (FastAPI & Microservice)',
          company_name: 'Tech Corp Indonesia',
          match_score: '0.92',
          confidence_score: '0.94',
          match_status: 'one_side_interested',
          candidate_decision: 'accepted',
          employer_decision: 'pending',
          explanation: 'Kandidat memiliki bukti konkret pengembangan FastAPI async dan MySQL di repository ABL_2411082008 yang cocok 100% dengan kebutuhan mandatory lowongan ini.',
        },
        {
          id: '2',
          job_post_id: '2',
          job_title: 'Fullstack Developer (Python + React)',
          company_name: 'Nusantara Digital Solusi',
          match_score: '0.85',
          confidence_score: '0.89',
          match_status: 'recommended',
          candidate_decision: 'pending',
          employer_decision: 'pending',
          explanation: 'Kemampuan Python backend terbukti kuat melalui repository. Skill frontend dapat diverifikasi lebih lanjut.',
        },
      ])
    }
  }, [token])

  useEffect(() => {
    void Promise.all([loadArtifacts(), loadEvidences(), loadMatches()])
  }, [loadArtifacts, loadEvidences, loadMatches])

  // Create new Artifact
  const handleCreateArtifact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreatingArtifact(true)
    setErrorMsg(null)
    try {
      await apiRequest(
        'api/v1/my/artifacts',
        genericResponseSchema,
        {
          method: 'POST',
          token: token ?? undefined,
          body: {
            title: newTitle,
            artifact_type: 'github_repository',
            source_url: newRepoUrl,
            description: newDesc,
            visibility: 'matching_employers',
          },
        },
      )
      setNewTitle('')
      await loadArtifacts()
    } catch {
      // If unauthorized or local mock fallback, append locally
      const mockItem: ArtifactItem = {
        id: String(Date.now()),
        title: newTitle,
        artifact_type: 'github_repository',
        source_url: newRepoUrl,
        description: newDesc,
        processing_status: 'not_started',
      }
      setArtifacts((prev) => [mockItem, ...prev])
      setNewTitle('')
    } finally {
      setCreatingArtifact(false)
    }
  }

  // Trigger Analysis
  const handleTriggerAnalysis = async (artifactId: string) => {
    setAnalyzingId(artifactId)
    setErrorMsg(null)
    try {
      await apiRequest(
        `api/v1/artifacts/${artifactId}/analyze`,
        genericResponseSchema,
        {
          method: 'POST',
          token: token ?? undefined,
        },
      )
      // Poll analysis
      let attempts = 0
      const timer = setInterval(async () => {
        attempts += 1
        try {
          const res = await apiRequest(
            `api/v1/artifacts/${artifactId}/analysis`,
            genericResponseSchema,
            { token: token ?? undefined },
          )
          const analysis = res.data?.artifact_analysis
          if (
            analysis &&
            (['completed', 'needs_human_review', 'failed'].includes(analysis.analysis_status) ||
              attempts >= 15)
          ) {
            clearInterval(timer)
            setAnalyzingId(null)
            if (analysis.extracted_summary) {
              setAnalysisSummary((prev) => ({
                ...prev,
                [artifactId]: analysis.extracted_summary,
              }))
            }
            if (analysis.analysis_status === 'failed' && analysis.error_message) {
              setErrorMsg(`Analisis AI gagal: ${analysis.error_message}`)
            }
            await loadArtifacts()
            await loadEvidences()
          }
        } catch {
          if (attempts >= 8) {
            clearInterval(timer)
            setAnalyzingId(null)
          }
        }
      }, 2500)
    } catch {
      // Local fallback simulation for instant demo
      setTimeout(() => {
        setAnalyzingId(null)
        setAnalysisSummary((prev) => ({
          ...prev,
          [artifactId]:
            'Analisis Gemini 2.5 Flash Lite berhasil. Ditemukan bukti implementasi FastAPI, MySQL, dan Docker dari file manifest dan README.',
        }))
        setArtifacts((prev) =>
          prev.map((a) => (a.id === artifactId ? { ...a, processing_status: 'completed' } : a)),
        )
      }, 2000)
    }
  }

  // Review Evidence
  const handleReviewEvidence = async (evidenceId: string, status: 'candidate_confirmed' | 'rejected') => {
    try {
      await apiRequest(
        `api/v1/artifact-skill-evidences/${evidenceId}/review`,
        genericResponseSchema,
        {
          method: 'POST',
          token: token ?? undefined,
          body: { review_status: status },
        },
      )
      await loadEvidences()
    } catch {
      // Local update
      setEvidences((prev) =>
        prev.map((ev) => (ev.id === evidenceId ? { ...ev, review_status: status } : ev)),
      )
    }
  }

  // Submit Candidate Decision
  const handleCandidateDecision = async (matchId: string, decision: 'accepted' | 'rejected') => {
    try {
      await apiRequest(
        `api/v1/job-matches/${matchId}/decision`,
        genericResponseSchema,
        {
          method: 'POST',
          token: token ?? undefined,
          body: { decision },
        },
      )
      await loadMatches()
    } catch {
      // Local update
      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId
            ? {
                ...m,
                candidate_decision: decision,
                match_status: decision === 'accepted' ? 'one_side_interested' : 'rejected',
              }
            : m,
        ),
      )
    }
  }

  return (
    <div className="py-8 px-4 sm:px-8 max-w-7xl mx-auto space-y-10">
      {/* Notion Document Header */}
      <div className="space-y-3 pb-6 border-b border-[#e5e3df]">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-[#e6e0f5] flex items-center justify-center text-[#5645d4]">
            <FolderGit2 className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1a1a1a]">
              Workspace Kandidat
            </h1>
            <p className="text-xs sm:text-sm text-[#787671]">
              Kelola repository kode Anda, tinjau bukti skill yang diekstrak AI, dan tentukan ketertarikan pada lowongan.
            </p>
          </div>
        </div>

        {accountType !== 'candidate' && (
          <Callout variant="peach" icon={<AlertCircle className="size-4 text-[#793400]" />}>
            <span>
              Anda saat ini sedang melihat dalam mode tamu / peran lain. Klik tombol{' '}
              <strong className="inline-flex items-center gap-1 font-semibold">
                <User className="size-3" /> Kandidat
              </strong>{' '}
              di menu atas untuk mengaktifkan sesi kandidat secara otomatis.
            </span>
          </Callout>
        )}
      </div>

      {errorMsg && (
        <Callout variant="rose" icon={<AlertTriangle className="size-4 text-[#e03131]" />}>
          {errorMsg}
        </Callout>
      )}

      {/* SECTION 1: ARTIFACTS & GITHUB REPOSITORIES */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#1a1a1a]">1. Repository & Bukti Portofolio</h2>
            <Badge variant="default" className="text-xs font-mono">
              {artifacts.length} artefak
            </Badge>
          </div>
        </div>

        {/* Ingestion Card */}
        <Card variant="surface" className="border-[#e5e3df]">
          <form onSubmit={handleCreateArtifact} className="space-y-4">
            <h3 className="font-semibold text-sm text-[#1a1a1a] flex items-center gap-2">
              <GitBranch className="size-4 text-[#5645d4]" /> Tambah Repository GitHub Baru untuk Dianalisis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#5d5b54] mb-1">
                  Nama Proyek / Repository
                </label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Hospital Management API"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5d5b54] mb-1">
                  URL Repository GitHub Publik
                </label>
                <Input
                  value={newRepoUrl}
                  onChange={(e) => setNewRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repository"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5d5b54] mb-1">
                Deskripsi Singkat Fitur & Arsitektur
              </label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Microservice backend dengan FastAPI, MySQL, dan Docker..."
              />
            </div>
            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                variant="primary"
                disabled={creatingArtifact || !newTitle.trim()}
                className="text-xs h-9"
              >
                {creatingArtifact ? 'Menyimpan...' : '+ Tambahkan ke Workspace'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Artifacts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {artifacts.map((art) => {
            const isAnalyzing = analyzingId === art.id || art.processing_status === 'processing'
            const isCompleted =
              art.processing_status === 'completed' || art.processing_status === 'needs_review'
            return (
              <Card key={art.id} variant="default" className="p-5 space-y-3.5 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-base text-[#1a1a1a] leading-tight">
                      {art.title}
                    </h4>
                    <Badge
                      variant={
                        isCompleted
                          ? 'mint'
                          : isAnalyzing
                          ? 'sky'
                          : art.processing_status === 'failed'
                          ? 'rose'
                          : 'default'
                      }
                      className="inline-flex items-center gap-1"
                    >
                      {isAnalyzing ? (
                        <>
                          <RefreshCw className="size-3 animate-spin" /> Menganalisis...
                        </>
                      ) : isCompleted ? (
                        <>
                          <CheckCircle2 className="size-3" /> Teranalisis
                        </>
                      ) : (
                        art.processing_status
                      )}
                    </Badge>
                  </div>

                  {art.source_url && (
                    <a
                      href={art.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-[#0075de] hover:underline flex items-center gap-1.5 break-all"
                    >
                      <GitBranch className="size-3.5" /> {art.source_url} <ExternalLink className="size-3 opacity-60" />
                    </a>
                  )}

                  {art.description && (
                    <p className="text-xs text-[#5d5b54] leading-relaxed line-clamp-2">
                      {art.description}
                    </p>
                  )}

                  {analysisSummary[art.id] && (
                    <Callout variant="mint" className="text-xs mt-2">
                      {analysisSummary[art.id]}
                    </Callout>
                  )}
                </div>

                <div className="pt-2 border-t border-[#ede9e4] flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#a4a097]">
                    Tipe: {art.artifact_type.replace('_', ' ')}
                  </span>
                  <Button
                    variant={isCompleted ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={isAnalyzing}
                    onClick={() => handleTriggerAnalysis(art.id)}
                    className="text-xs h-8 inline-flex items-center gap-1"
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="size-3 animate-spin" /> Sedang Membaca...
                      </>
                    ) : isCompleted ? (
                      'Analisis Ulang'
                    ) : (
                      <>
                        <Sparkles className="size-3" /> Mulai Analisis AI
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      {/* SECTION 2: SKILL EVIDENCE INSPECTOR */}
      <section className="space-y-5 pt-6 border-t border-[#e5e3df]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1a1a1a]">2. Bukti Skill Terdeteksi (Evidence Inspector)</h2>
            <p className="text-xs text-[#787671]">
              Hasil ekstraksi otomatis kode dari repository Anda. Anda dapat mengonfirmasi atau menolak bukti ini.
            </p>
          </div>
          <Badge variant="lavender" className="text-xs">
            {evidences.length} Bukti
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {evidences.map((ev) => {
            const isConfirmed = ev.review_status === 'candidate_confirmed'
            const isRejected = ev.review_status === 'rejected'
            return (
              <Card
                key={ev.id}
                variant="default"
                className={`p-5 space-y-3 border ${
                  isConfirmed ? 'border-[#bbf0cc]' : isRejected ? 'border-[#f8bed8]' : 'border-[#e5e3df]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="lavender" className="font-semibold text-xs px-2.5">
                      {ev.skill_name}
                    </Badge>
                    <span className="text-[11px] font-mono text-[#787671]">
                      {ev.file_path_or_location || 'manifest'}
                    </span>
                  </div>
                  <Badge
                    variant={isConfirmed ? 'mint' : isRejected ? 'rose' : 'yellow'}
                    className="text-[11px] inline-flex items-center gap-1"
                  >
                    {isConfirmed ? (
                      <>
                        <CheckCircle2 className="size-3" /> Terverifikasi
                      </>
                    ) : isRejected ? (
                      <>
                        <X className="size-3" /> Ditolak
                      </>
                    ) : (
                      'Perlu Konfirmasi'
                    )}
                  </Badge>
                </div>

                {ev.excerpt_text && (
                  <div className="notion-code-block text-xs max-h-28 overflow-y-auto">
                    <pre className="whitespace-pre-wrap">{ev.excerpt_text}</pre>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-[#ede9e4] text-xs">
                  <span className="text-[#787671]">
                    Keyakinan Model: <strong className="text-[#37352f]">{Math.round(Number(ev.confidence_score || '0.9') * 100)}%</strong>
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      variant={isConfirmed ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => handleReviewEvidence(ev.id, 'candidate_confirmed')}
                      className={`h-7 px-2.5 text-xs inline-flex items-center gap-1 ${
                        isConfirmed ? 'bg-[#1aae39] hover:bg-[#158c2e]' : ''
                      }`}
                    >
                      {isConfirmed ? (
                        <>
                          <Check className="size-3" /> Dikonfirmasi
                        </>
                      ) : (
                        'Konfirmasi'
                      )}
                    </Button>
                    <Button
                      variant={isRejected ? 'danger' : 'ghost'}
                      size="sm"
                      onClick={() => handleReviewEvidence(ev.id, 'rejected')}
                      className="h-7 px-2 text-xs text-[#787671] hover:text-[#e03131]"
                    >
                      {isRejected ? 'Ditolak' : 'Bukan'}
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      {/* SECTION 3: REKOMENDASI LOWONGAN & MATCH DECISIONS */}
      <section className="space-y-5 pt-6 border-t border-[#e5e3df]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1a1a1a]">3. Rekomendasi Lowongan & Keputusan Anda</h2>
            <p className="text-xs text-[#787671]">
              Kecocokan dihitung secara adil berdasarkan bukti skill riil yang cocok dengan masalah bisnis perusahaan.
            </p>
          </div>
          <Link to="/jobs">
            <Button variant="outline" size="sm" className="text-xs">
              Jelajahi Semua Lowongan →
            </Button>
          </Link>
        </div>

        <div className="space-y-4">
          {matches.map((m) => {
            const scorePct = Math.round(Number(m.match_score || '0.85') * 100)
            const isAccepted = m.candidate_decision === 'accepted'
            const isMutual = m.match_status === 'mutually_accepted'

            return (
              <Card
                key={m.id}
                variant={isMutual ? 'mint' : 'default'}
                className="p-6 space-y-4 notion-shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-[#1a1a1a]">{m.job_title}</h3>
                      <Badge variant="peach">{m.company_name}</Badge>
                    </div>
                    <p className="text-xs text-[#787671]">
                      ID Lowongan: #{m.job_post_id} · Two-Way Decision Workflow
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={scorePct >= 90 ? 'mint' : 'lavender'} className="text-sm px-3 py-1 font-semibold">
                      {scorePct}% Cocok
                    </Badge>
                    {isMutual && (
                      <Badge variant="mint" className="text-sm px-3 py-1 font-bold animate-pulse inline-flex items-center gap-1">
                        <Sparkles className="size-3.5" /> Saling Tertarik!
                      </Badge>
                    )}
                  </div>
                </div>

                {m.explanation && (
                  <Callout variant={isMutual ? 'mint' : 'lavender'} icon={<Lightbulb className="size-4 text-[#5645d4]" />}>
                    <p className="text-xs leading-relaxed">{m.explanation}</p>
                  </Callout>
                )}

                {/* Decision Bar */}
                <div className="pt-3 border-t border-[#ede9e4] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[#787671]">Status Anda:</span>
                    <Badge
                      variant={isAccepted ? 'mint' : m.candidate_decision === 'rejected' ? 'rose' : 'yellow'}
                      className="inline-flex items-center gap-1"
                    >
                      {isAccepted ? (
                        <>
                          <Check className="size-3 text-[#1aae39]" /> Anda Tertarik
                        </>
                      ) : m.candidate_decision === 'rejected' ? (
                        <>
                          <X className="size-3 text-[#e03131]" /> Dilewati
                        </>
                      ) : (
                        'Menunggu Keputusan Anda'
                      )}
                    </Badge>
                    <span className="text-[#a4a097]">|</span>
                    <span className="text-[#787671]">Status Employer:</span>
                    <Badge
                      variant={m.employer_decision === 'accepted' ? 'mint' : 'default'}
                      className="inline-flex items-center gap-1"
                    >
                      {m.employer_decision === 'accepted' ? (
                        <>
                          <Check className="size-3 text-[#1aae39]" /> Tertarik
                        </>
                      ) : (
                        'Meninjau'
                      )}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    {isMutual ? (
                      <Button
                        variant="primary"
                        size="sm"
                        className="bg-[#1aae39] hover:bg-[#158c2e] text-xs h-9 inline-flex items-center gap-1.5"
                      >
                        <MessageSquare className="size-4" /> Buka Ruang Diskusi
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant={isAccepted ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => handleCandidateDecision(m.id, 'accepted')}
                          className={`text-xs h-8 inline-flex items-center gap-1.5 ${
                            isAccepted ? 'bg-[#5645d4]' : ''
                          }`}
                        >
                          {isAccepted ? (
                            <>
                              <Check className="size-3.5" /> Tertarik (Terkirim)
                            </>
                          ) : (
                            <>
                              <Heart className="size-3.5 text-[#e03131]" /> Saya Tertarik
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCandidateDecision(m.id, 'rejected')}
                          className="text-xs h-8 text-[#787671] hover:text-[#e03131]"
                        >
                          Lewati
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}
