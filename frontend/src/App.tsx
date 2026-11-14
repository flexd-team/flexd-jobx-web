import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import Home from '@/pages/home'
import NotFound from '@/pages/not-found'
import GitHubPage from '@/pages/github'

export default function App() {
  return <AppShell><Routes><Route path="/" element={<Home />} /><Route path="/github" element={<GitHubPage />} /><Route path="/auth/github/callback" element={<GitHubPage />} /><Route path="*" element={<NotFound />} /></Routes></AppShell>
}
