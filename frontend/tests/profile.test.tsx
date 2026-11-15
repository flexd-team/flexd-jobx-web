import { afterEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import authReducer, { setSession } from '@/redux/slices/auth-slice'
import ProfilePage from '@/pages/profile'

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

const profile = {
  headline: 'Full-stack Developer', biography: 'Build business apps', city: 'Bandung',
  country: 'Indonesia', years_experience: '2.5', preferred_employment_type: 'full_time',
  preferred_work_mode: 'remote', profile_visibility: 'matching_only',
}
function mount() {
  const store = configureStore({ reducer: { auth: authReducer } })
  store.dispatch(setSession({ token: 'test-only', accountType: 'candidate' }))
  render(<Provider store={store}><ProfilePage /></Provider>)
}
function response(value: object | null) {
  return new Response(JSON.stringify({ message: { success: 'OK' }, error: {},
    data: { candidate_profile: value } }), { status: 200 })
}

it('loads DECIMAL experience and saves fractional years with backend visibility', async () => {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response(profile)))
  vi.stubGlobal('fetch', fetchMock)
  mount()
  expect(await screen.findByDisplayValue('Full-stack Developer')).toBeInTheDocument()
  expect(screen.getByRole('spinbutton', { name: 'Pengalaman (tahun)' })).toHaveValue(2.5)
  expect(screen.getByRole('combobox', { name: 'Visibilitas profil' })).toHaveValue('matching_only')
  expect(screen.queryByText('Data response API tidak sesuai kontrak.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Simpan perubahan' }))
  expect(await screen.findByText('Profil tersimpan.')).toBeInTheDocument()
  const post = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST')
  expect(JSON.parse(post![1].body)).toMatchObject({ years_experience: '2.5', profile_visibility: 'matching_only' })
})

it('handles null experience without rejecting profile', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...profile, years_experience: null })))
  mount()
  await screen.findByDisplayValue('Full-stack Developer')
  expect(screen.getByRole('spinbutton', { name: 'Pengalaman (tahun)' })).toHaveValue(0)
})

it('does not bypass response validation for malformed experience', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...profile, years_experience: 'invalid' })))
  mount()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Simpan perubahan' })).toBeDisabled())
  expect(await screen.findByText('Data response API tidak sesuai kontrak.')).toBeInTheDocument()
})
