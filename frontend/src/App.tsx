import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import Home from '@/pages/home'
import WorkspacePage from '@/pages/workspace'
import JobsPage from '@/pages/jobs'
import ProfilePage from '@/pages/profile'
import AccountPage from '@/pages/account'
import GitHubPage from '@/pages/github'
import NotFound from '@/pages/not-found'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/github" element={<GitHubPage />} />
        <Route path="/auth/github/callback" element={<GitHubPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  )
}
