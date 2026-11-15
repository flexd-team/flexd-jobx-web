import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import GitHubPage from '../src/pages/github'
import appReducer from '../src/redux/slices/app-slice'
import authReducer from '../src/redux/slices/auth-slice'

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))
import { apiRequest } from '@/lib/api-client'

it('exchanges handoff code and stores full user session in Redux', async () => {
  window.history.replaceState({}, '', '/auth/github/callback?code=valid-handoff')
  vi.mocked(apiRequest).mockResolvedValueOnce({
    data: {
      auth: { access_token: 'test-jwt-token', token_type: 'bearer' },
      user: {
        id: '15',
        name: 'Talent Developer',
        email: 'talent@example.com',
        account_type: 'candidate',
      },
    },
  })

  const store = configureStore({ reducer: { app: appReducer, auth: authReducer } })
  render(
    <Provider store={store}>
      <GitHubPage />
    </Provider>,
  )

  await waitFor(() => {
    const state = store.getState().auth
    expect(state.token).toBe('test-jwt-token')
    expect(state.accountType).toBe('candidate')
    expect(state.user?.name).toBe('Talent Developer')
    expect(state.user?.email).toBe('talent@example.com')
  })

  expect(await screen.findByRole('status')).toHaveTextContent('Login berhasil')
})
