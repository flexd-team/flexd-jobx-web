import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import authReducer, { setSession } from '@/redux/slices/auth-slice'
import { ArtifactsPage } from '@/pages/portal'
import ArtifactDetailPage from '@/pages/artifact-detail'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear() })
const item = { id: '7', title: 'API project', artifact_type: 'github_repository', description: 'My API', visibility: 'private', source_url: 'https://github.com/example/api', processing_status: 'completed' }
const detail = { artifact: item, artifact_contribution: { id: '3', role_title: 'Developer', contribution_description: 'Built validation', claim_status: 'self_declared' }, artifact_analysis: { id: '9', analysis_status: 'completed', extracted_summary: 'Python API', error_message: null } }
const response = (data: object) => new Response(JSON.stringify({ message: { success: 'OK' }, error: {}, data }), { status: 200 })
function mount(path: string) {
  const store = configureStore({ reducer: { auth: authReducer } })
  store.dispatch(setSession({ token: 'test-only', accountType: 'candidate' }))
  return render(<Provider store={store}><MemoryRouter initialEntries={[path]}><Routes><Route path="/candidate/artifacts" element={<ArtifactsPage/>}/><Route path="/candidate/artifacts/:artifactId" element={<ArtifactDetailPage/>}/></Routes></MemoryRouter></Provider>)
}
it('opens create in modal, guards dirty close, saves and closes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, options?: RequestInit) => Promise.resolve(options?.method === 'POST' ? response({ artifact: item }) : response({ artifacts: [], pagination: { total: 0, limit: 20, offset: 0 } }))))
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  mount('/candidate/artifacts')
  await userEvent.click(screen.getByRole('button', { name: 'Tambah artifact' }))
  const dialog = screen.getByRole('dialog', { name: 'Tambah artifact' })
  expect(within(dialog).queryByRole('option', { name: 'Tautan desain' })).not.toBeInTheDocument()
  expect(within(dialog).queryByRole('textbox', { name: 'URL sumber' })).not.toBeInTheDocument()
  await userEvent.type(within(dialog).getByRole('textbox', { name: 'Judul' }), 'API project')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Batal' }))
  expect(confirm).toHaveBeenCalled()
  expect(dialog).toBeInTheDocument()
  await userEvent.upload(within(dialog).getByLabelText('File karya'), new File(['hello'], 'notes.txt', {type:'text/plain'}))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan artifact' }))
  expect(await screen.findByText('Karya pertama membuka cerita baru.')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('renders scoped evidence and loads existing contribution into edit modal', async () => {
  const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => Promise.resolve(options?.method === 'PATCH' ? response({ artifact: item }) : url.includes('skill-evidences') ? response({ artifact_skill_evidences: [{ id: '1', artifact_id: '7', analysis_id: '9', skill_id: '2', skill_name: 'Python', evidence_kind: 'direct', evidence_excerpt: 'import python', evidence_location: 'main.py:1', confidence_score: '0.9', review_status: 'reviewer_verified' }], pagination: { total: 1, limit: 20, offset: 0 } }) : response(detail)))
  vi.stubGlobal('fetch', fetchMock)
  mount('/candidate/artifacts/7')
  expect(await screen.findByRole('heading', { name: 'API project' })).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: 'Python' })).toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([url]) => url.includes('/my/artifacts/7/skill-evidences'))).toBe(true)
  expect(screen.queryByRole('button', { name: 'Konfirmasi' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Edit artifact' }))
  const dialog = await screen.findByRole('dialog', { name: 'Edit artifact' })
  expect(await within(dialog).findByDisplayValue('Developer')).toBeInTheDocument()
  expect(within(dialog).getByDisplayValue('Built validation')).toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan perubahan' }))
  expect(await screen.findByRole('heading', { name: 'API project' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
