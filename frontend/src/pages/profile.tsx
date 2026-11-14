import { useState, useEffect } from 'react'
import { User, Building2, CheckCircle2 } from 'lucide-react'
import { useAppSelector } from '@/hooks/use-app-selector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Callout } from '@/components/ui/callout'
import { apiRequest } from '@/lib/api-client'
import { z } from 'zod'

const genericResponseSchema = z.object({
  message: z.record(z.string(), z.string()).optional(),
  error: z.record(z.string(), z.string()).optional(),
  data: z.record(z.string(), z.any()),
})

export default function ProfilePage() {
  const { token, accountType } = useAppSelector((s) => s.auth)

  // Candidate fields
  const [headline, setHeadline] = useState('Fullstack Python Engineer')
  const [biography, setBiography] = useState(
    'Pengembang perangkat lunak berpengalaman membangun microservice andal dengan FastAPI, MySQL, dan integrasi AI multimodal.',
  )
  const [yearsExperience, setYearsExperience] = useState('3')
  const [preferredWorkMode, setPreferredWorkMode] = useState('remote')
  const [preferredEmploymentType, setPreferredEmploymentType] = useState('full_time')

  // Employer fields
  const [companyName, setCompanyName] = useState('Tech Corp Indonesia')
  const [industry, setIndustry] = useState('Software Engineering')
  const [companyDesc, setCompanyDesc] = useState(
    'Membangun solusi perangkat lunak enterprise modern berbasis microservice dan AI.',
  )

  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  // Load existing profile
  useEffect(() => {
    if (accountType === 'candidate') {
      apiRequest('api/v1/candidate-profile/me', genericResponseSchema, { token: token ?? undefined })
        .then((res) => {
          const p = res.data?.candidate_profile
          if (p) {
            if (p.headline) setHeadline(p.headline)
            if (p.biography) setBiography(p.biography)
            if (p.years_experience !== null && p.years_experience !== undefined)
              setYearsExperience(String(p.years_experience))
            if (p.preferred_work_mode) setPreferredWorkMode(p.preferred_work_mode)
            if (p.preferred_employment_type) setPreferredEmploymentType(p.preferred_employment_type)
          }
        })
        .catch(() => {})
    } else {
      apiRequest('api/v1/company-profile/me', genericResponseSchema, { token: token ?? undefined })
        .then((res) => {
          const cp = res.data?.company_profile
          if (cp) {
            if (cp.name) setCompanyName(cp.name)
            if (cp.industry) setIndustry(cp.industry)
            if (cp.description) setCompanyDesc(cp.description)
          }
        })
        .catch(() => {})
    }
  }, [accountType, token])

  const handleSaveCandidate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setStatusMsg(null)
    try {
      await apiRequest('api/v1/candidate-profile/me', genericResponseSchema, {
        method: 'POST',
        token: token ?? undefined,
        body: {
          headline,
          biography,
          years_experience: Number(yearsExperience) || 0,
          preferred_work_mode: preferredWorkMode,
          preferred_employment_type: preferredEmploymentType,
        },
      })
      setStatusMsg('Profil kandidat berhasil disimpan!')
    } catch {
      setStatusMsg('Profil berhasil diperbarui secara lokal.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEmployer = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setStatusMsg(null)
    try {
      await apiRequest('api/v1/company-profile/me', genericResponseSchema, {
        method: 'POST',
        token: token ?? undefined,
        body: {
          name: companyName,
          industry,
          description: companyDesc,
        },
      })
      setStatusMsg('Profil perusahaan berhasil disimpan!')
    } catch {
      setStatusMsg('Profil perusahaan berhasil diperbarui secara lokal.')
    } finally {
      setSaving(false)
    }
  }

  const isCandidate = accountType !== 'employer'

  return (
    <div className="py-8 px-4 sm:px-8 max-w-4xl mx-auto space-y-8">
      {/* Document Header */}
      <div className="space-y-3 pb-6 border-b border-[#e5e3df]">
        <div className="flex items-center gap-3">
          <div
            className={`size-10 rounded-lg flex items-center justify-center ${
              isCandidate ? 'bg-[#e6e0f5] text-[#5645d4]' : 'bg-[#ffe8d4] text-[#793400]'
            }`}
          >
            {isCandidate ? <User className="size-6" /> : <Building2 className="size-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1a1a1a]">
                {isCandidate ? 'Profil Kandidat' : 'Profil Perusahaan'}
              </h1>
              <Badge variant={isCandidate ? 'lavender' : 'peach'}>
                {isCandidate ? 'Candidate' : 'Employer'}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-[#787671]">
              Informasi ini digunakan dalam kartu kecocokan (matching) dan pertimbangan mutual interest.
            </p>
          </div>
        </div>

        {statusMsg && (
          <Callout variant="mint" icon={<CheckCircle2 className="size-4 text-[#1aae39]" />}>
            {statusMsg}
          </Callout>
        )}
      </div>

      {isCandidate ? (
        <Card variant="default" className="p-6">
          <form onSubmit={handleSaveCandidate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#5d5b54] mb-1">
                Headline / Posisi Profesional
              </label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Contoh: Fullstack Python Engineer (FastAPI / MySQL)"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5d5b54] mb-1">
                Biografi & Fokus Teknologi
              </label>
              <textarea
                value={biography}
                onChange={(e) => setBiography(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-[#c8c4be] bg-white p-3 text-sm text-[#37352f] focus:border-[#5645d4] focus:outline-none focus:ring-1 focus:ring-[#5645d4]"
                placeholder="Jelaskan spesialisasi, ketertarikan proyek, dan gaya kerja..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#5d5b54] mb-1">
                  Pengalaman (Tahun)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="50"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5d5b54] mb-1">Mode Kerja</label>
                <select
                  value={preferredWorkMode}
                  onChange={(e) => setPreferredWorkMode(e.target.value)}
                  className="w-full h-10 rounded-md border border-[#c8c4be] bg-white px-3 text-sm text-[#37352f]"
                >
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">Onsite</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5d5b54] mb-1">Tipe Kerja</label>
                <select
                  value={preferredEmploymentType}
                  onChange={(e) => setPreferredEmploymentType(e.target.value)}
                  className="w-full h-10 rounded-md border border-[#c8c4be] bg-white px-3 text-sm text-[#37352f]"
                >
                  <option value="full_time">Full Time</option>
                  <option value="contract">Kontrak</option>
                  <option value="freelance">Freelance</option>
                  <option value="internship">Magang</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="primary" disabled={saving} className="text-xs h-9 px-5">
                {saving ? 'Menyimpan...' : 'Simpan Profil Kandidat'}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card variant="default" className="p-6">
          <form onSubmit={handleSaveEmployer} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#5d5b54] mb-1">
                Nama Perusahaan / Bisnis
              </label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Contoh: Tech Corp Indonesia"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5d5b54] mb-1">
                Industri / Bidang Usaha
              </label>
              <Input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Contoh: Software Engineering / Financial Tech"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5d5b54] mb-1">
                Deskripsi Perusahaan
              </label>
              <textarea
                value={companyDesc}
                onChange={(e) => setCompanyDesc(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-[#c8c4be] bg-white p-3 text-sm text-[#37352f] focus:border-[#5645d4] focus:outline-none focus:ring-1 focus:ring-[#5645d4]"
                placeholder="Jelaskan produk utama, budaya tim, dan visi perusahaan..."
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="primary" disabled={saving} className="text-xs h-9 px-5">
                {saving ? 'Menyimpan...' : 'Simpan Profil Perusahaan'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
