import { env } from '@/lib/env'
import { ApiError } from '@/lib/api-error'

export const artifactFileFormats: Record<string, string[]> = {
  document: ['pdf', 'docx', 'txt'], spreadsheet: ['xlsx', 'csv'],
  image: ['png', 'jpg', 'jpeg', 'webp'], video: ['mp4'],
}
export const defaultUploadLimit = 20_000_000

export async function downloadArtifact(id: string, token: string, filename: string) {
  const response = await fetch(`${env.APP_PUBLIC_API_BASE_URL.replace(/\/$/, '')}/my/artifacts/${id}/file`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new ApiError(response.status, 'File gagal diunduh. Periksa sesi dan coba lagi.')
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url; link.download = filename; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
