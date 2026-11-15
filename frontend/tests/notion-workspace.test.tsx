import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import authReducer from '@/redux/slices/auth-slice'
import appReducer from '@/redux/slices/app-slice'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Callout } from '@/components/ui/callout'
import Home from '@/pages/home'
import WorkspacePage from '@/pages/workspace'
import { AppShell } from '@/components/layout/app-shell'

function renderWithProviders(ui: React.ReactElement, initialRoute = '/') {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      app: appReducer,
    },
  })
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {ui}
      </MemoryRouter>
    </Provider>,
  )
}

describe('Notion UI Primitives', () => {
  it('renders Notion Button with primary purple variant and rectangular geometry', () => {
    render(<Button variant="primary">Mulai Gratis</Button>)
    const btn = screen.getByRole('button', { name: 'Mulai Gratis' })
    expect(btn).toBeInTheDocument()
    expect(btn.className).toContain('bg-[#5645d4]')
    expect(btn.className).toContain('rounded-md')
  })

  it('renders Notion Badges with pastel variants', () => {
    const { container } = render(
      <div>
        <Badge variant="mint">92% Match</Badge>
        <Badge variant="lavender">FastAPI</Badge>
        <Badge variant="peach">Tech Corp</Badge>
      </div>,
    )
    expect(container.textContent).toContain('92% Match')
    expect(container.textContent).toContain('FastAPI')
    expect(container.textContent).toContain('Tech Corp')
  })

  it('renders Notion Card and Callout blocks', () => {
    render(
      <Card variant="mint">
        <Callout variant="mint" icon="✓">
          Bukti terkonfirmasi
        </Callout>
      </Card>,
    )
    expect(screen.getByText('Bukti terkonfirmasi')).toBeInTheDocument()
  })
})

describe('Notion Navigation & Pages', () => {
  it('renders public navigation without simulated role sessions', () => {
    renderWithProviders(<AppShell><div>Test Content</div></AppShell>)
    expect(screen.getByRole('link', { name: 'JobX beranda' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navigasi publik' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Mulai sekarang/ })).toHaveAttribute('href', '/account?mode=register')
    expect(screen.queryByTitle('Simulasi login sebagai Kandidat')).not.toBeInTheDocument()
  })

  it('renders Home page with Notion hero and purple CTA', () => {
    renderWithProviders(<Home />)
    expect(screen.getByRole('heading', { level: 1, name: /Tunjukkan apa yang kamu buat/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Mulai sebagai kandidat/i })).toHaveAttribute('href', '/account?mode=register')
    expect(screen.getByRole('link', { name: /Saya mencari talenta/i })).toHaveAttribute('href', '/account?mode=register&role=employer')
  })

  it('renders Workspace page with evidence inspector and match recommendations', () => {
    renderWithProviders(<WorkspacePage />, '/workspace')
    expect(screen.getByRole('heading', { name: /Workspace Kandidat/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Repository & Bukti Portofolio/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Bukti Skill Terdeteksi/i })).toBeInTheDocument()
  })
})
