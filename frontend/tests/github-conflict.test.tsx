import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import GitHubPage from '../src/pages/github'
import appReducer from '../src/redux/slices/app-slice'
import authReducer from '../src/redux/slices/auth-slice'
import { ApiError } from '../src/lib/api-error'

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))
import { apiRequest } from '@/lib/api-client'

it('explains email conflict and discards consumed registration code', async () => {
  window.history.replaceState({}, '', '/auth/github/callback?code=handoff')
  vi.mocked(apiRequest)
    .mockResolvedValueOnce({ data: { registration_code: 'registration' } })
    .mockRejectedValueOnce(new ApiError(409, 'Resource conflict', { email: 'Sign in to link existing account' }))
  const store = configureStore({ reducer: { app: appReducer, auth: authReducer } })
  render(<Provider store={store}><GitHubPage /></Provider>)
  await userEvent.click(await screen.findByRole('button', { name: 'Kandidat' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Email GitHub sudah terdaftar')
  expect(screen.getByRole('button', { name: 'Login dengan password' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Kandidat' })).not.toBeInTheDocument()
})
