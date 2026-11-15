import type { z } from 'zod'
import { env } from '@/lib/env'
import { ApiError } from '@/lib/api-error'
import { responseSchema } from '@/schemas/response'

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown; token?: string }

export async function apiRequest<T extends z.ZodType>(
  path: string,
  schema: T,
  { body, token, headers, ...options }: RequestOptions = {},
): Promise<z.infer<T>> {
  const requestHeaders = new Headers(headers)
  requestHeaders.set('Accept', 'application/json')
  if (body !== undefined) requestHeaders.set('Content-Type', 'application/json')
  if (token) requestHeaders.set('Authorization', `Bearer ${token}`)

  let response: Response
  const normalizedPath = path.replace(/^\/?(api\/v1\/)?/, '').replace(/^\//, '')
  const targetUrl = `${env.APP_PUBLIC_API_BASE_URL.replace(/\/$/, '')}/${normalizedPath}`
  try {
    response = await fetch(targetUrl, {
      ...options,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options.signal ?? AbortSignal.timeout(30_000),
    })
  } catch {
    throw new ApiError(0, 'Koneksi gagal. Periksa jaringan dan coba lagi.')
  }

  const parsed = responseSchema.safeParse(await response.json().catch(() => null))
  if (!parsed.success) throw new ApiError(response.status, 'Format response API tidak valid.')
  if (!response.ok) {
    throw new ApiError(response.status, parsed.data.message.error ?? 'Permintaan gagal.', parsed.data.error)
  }
  const result = schema.safeParse(parsed.data)
  if (!result.success) throw new ApiError(response.status, 'Data response API tidak sesuai kontrak.')
  return result.data
}
