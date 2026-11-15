import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { useAppSelector } from "@/hooks/use-app-selector";
import Home from "@/pages/home";
import ProfilePage from "@/pages/profile";
import AccountPage from "@/pages/account";
import GitHubPage from "@/pages/github";
import NotFound from "@/pages/not-found";
import {
  ArtifactsPage,
  EvidencePage,
  FindJobsPage,
  MatchesPage,
  OverviewPage,
} from "@/pages/portal";
import {
  CandidatesPage,
  CreateJobPage,
  MyJobsPage,
} from "@/pages/employer-portal";
import { AdminPage } from "@/pages/admin-portal";

function Protected({ role, children }: { role: string; children: ReactNode }) {
  const { token, accountType } = useAppSelector((s) => s.auth);
  if (!token) return <Navigate to="/account" replace />;
  if (accountType !== role)
    return (
      <Navigate
        to={`/${accountType === "admin" ? "admin" : accountType === "employer" ? "employer" : "candidate"}/overview`}
        replace
      />
    );
  return children;
}
function LegacyRedirect({ profile = false }: { profile?: boolean }) {
  const role = useAppSelector((s) => s.auth.accountType);
  return (
    <Navigate
      replace
      to={
        role === "employer"
          ? profile
            ? "/employer/company"
            : "/employer/my-jobs"
          : profile
            ? "/candidate/profile"
            : "/candidate/overview"
      }
    />
  );
}
export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/workspace" element={<LegacyRedirect />} />
        <Route path="/jobs" element={<LegacyRedirect />} />
        <Route path="/profile" element={<LegacyRedirect profile />} />
        <Route
          path="/github"
          element={
            <Protected role="candidate">
              <GitHubPage />
            </Protected>
          }
        />
        <Route path="/auth/github/callback" element={<GitHubPage />} />
        <Route
          path="/candidate/overview"
          element={
            <Protected role="candidate">
              <OverviewPage />
            </Protected>
          }
        />
        <Route
          path="/candidate/artifacts"
          element={
            <Protected role="candidate">
              <ArtifactsPage />
            </Protected>
          }
        />
        <Route
          path="/candidate/evidence"
          element={
            <Protected role="candidate">
              <EvidencePage />
            </Protected>
          }
        />
        <Route
          path="/candidate/jobs"
          element={
            <Protected role="candidate">
              <FindJobsPage />
            </Protected>
          }
        />
        <Route
          path="/candidate/matches"
          element={
            <Protected role="candidate">
              <MatchesPage />
            </Protected>
          }
        />
        <Route
          path="/candidate/profile"
          element={
            <Protected role="candidate">
              <ProfilePage />
            </Protected>
          }
        />
        <Route
          path="/candidate/settings"
          element={
            <Protected role="candidate">
              <AccountPage />
            </Protected>
          }
        />
        <Route
          path="/employer/overview"
          element={
            <Protected role="employer">
              <OverviewPage />
            </Protected>
          }
        />
        <Route
          path="/employer/company"
          element={
            <Protected role="employer">
              <ProfilePage />
            </Protected>
          }
        />
        <Route
          path="/employer/my-jobs"
          element={
            <Protected role="employer">
              <MyJobsPage />
            </Protected>
          }
        />
        <Route
          path="/employer/create-job"
          element={
            <Protected role="employer">
              <CreateJobPage />
            </Protected>
          }
        />
        <Route
          path="/employer/candidates"
          element={
            <Protected role="employer">
              <CandidatesPage />
            </Protected>
          }
        />
        <Route
          path="/employer/matches"
          element={
            <Protected role="employer">
              <CandidatesPage matchesOnly />
            </Protected>
          }
        />
        <Route
          path="/employer/settings"
          element={
            <Protected role="employer">
              <AccountPage />
            </Protected>
          }
        />
        {["overview", "users", "skills", "aliases"].map((section) => (
          <Route
            key={section}
            path={`/admin/${section}`}
            element={
              <Protected role="admin">
                <AdminPage section={section} />
              </Protected>
            }
          />
        ))}
        <Route
          path="/admin/settings"
          element={
            <Protected role="admin">
              <AccountPage />
            </Protected>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  );
}
