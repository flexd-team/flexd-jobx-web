import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Compass,
  Fingerprint,
  FolderGit2,
  Heart,
  House,
  Link2,
  LogOut,
  Menu,
  PanelLeftClose,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useAppSelector } from "@/hooks/use-app-selector";
import { useAppDispatch } from "@/hooks/use-app-dispatch";
import { clearSession } from "@/redux/slices/auth-slice";

const candidateNav = [
  { to: "/candidate/overview", label: "Overview", icon: House },
  { to: "/candidate/profile", label: "My Profile", icon: Fingerprint },
  { to: "/candidate/artifacts", label: "Smart Artifacts", icon: FolderGit2 },
  { to: "/candidate/evidence", label: "Skill Evidence", icon: Sparkles },
  { to: "/candidate/jobs", label: "Find Jobs", icon: Compass },
  { to: "/candidate/matches", label: "My Matches", icon: Heart },
];
const employerNav = [
  { to: "/employer/overview", label: "Overview", icon: House },
  { to: "/employer/company", label: "Company Profile", icon: Building2 },
  { to: "/employer/my-jobs", label: "My Jobs", icon: BriefcaseBusiness },
  { to: "/employer/create-job", label: "Create Job", icon: Sparkles },
  { to: "/employer/candidates", label: "Find Candidates", icon: Users },
  { to: "/employer/matches", label: "Matches", icon: Heart },
];
const adminNav = [
  { to: "/admin/overview", label: "Overview", icon: House },
  { to: "/admin/users", label: "User Management", icon: Users },
  { to: "/admin/skills", label: "Skill Management", icon: ShieldCheck },
  { to: "/admin/aliases", label: "Skill Aliases", icon: Link2 },
];

export function JobXLogo() {
  return (
    <span className="jx-logo">
      <svg viewBox="0 0 38 34" aria-hidden="true">
        <path
          d="M3 4h13v17c0 7-4 10-10 10H2v-7h3c3 0 4-1 4-4v-9H3z"
          fill="currentColor"
        />
        <path
          d="m18 4 6 9 5-9h7L27 17l9 14h-8l-5-8-5 8h-7l9-14-8-13z"
          fill="#5645d4"
        />
      </svg>
      <span>
        Job<span className="jx-purple">X</span>
      </span>
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const dispatch = useAppDispatch();
  const { token, accountType, user } = useAppSelector((s) => s.auth);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 700px)");
    const sync = () => {
      sidebar.inert = media.matches && !mobileOpen;
    };
    sync();
    if (
      !mobileOpen &&
      media.matches &&
      sidebar.contains(document.activeElement)
    )
      menuRef.current?.focus();
    media.addEventListener("change", sync);
    if (mobileOpen)
      sidebar.querySelector<HTMLButtonElement>(".jx-mobile-close")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (!mobileOpen || !media.matches) return;
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuRef.current?.focus();
      }
      if (event.key === "Tab") {
        const elements = [
          ...sidebar.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled])",
          ),
        ].filter((element) => element.getClientRects().length > 0);
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    const previous = document.body.style.overflow;
    if (mobileOpen && media.matches) document.body.style.overflow = "hidden";
    return () => {
      media.removeEventListener("change", sync);
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previous;
    };
  }, [mobileOpen, pathname]);
  const workspace =
    /^\/(candidate|employer|admin)(\/|$)/.test(pathname) ||
    pathname === "/github";
  const role =
    accountType === "admin"
      ? "admin"
      : accountType === "employer"
        ? "employer"
        : "candidate";
  const nav =
    role === "admin"
      ? adminNav
      : role === "employer"
        ? employerNav
        : candidateNav;
  const current =
    nav.find((item) => item.to === pathname || pathname.startsWith(`${item.to}/`))?.label ??
    (pathname.endsWith("settings") ? "Settings" : "GitHub");
  const name = user?.name || user?.email || "Akun JobX";

  if (!workspace)
    return (
      <div className="jx-public">
        <a className="jx-skip" href="#main-content">
          Lewati navigasi
        </a>
        <header className="jx-public-header">
          <Link to="/" aria-label="JobX beranda">
            <JobXLogo />
          </Link>
          <nav aria-label="Navigasi publik">
            <a href="/#cara-kerja">Cara kerja</a>
            <a href="/#untuk-perusahaan">Untuk perusahaan</a>
          </nav>
          <div className="jx-actions">
            <Link to="/account">Masuk</Link>
            <Link
              className="jx-button primary"
              to={token ? `/${role}/overview` : "/account?mode=register"}
            >
              {token ? "Buka workspace" : "Mulai sekarang"}
              <ArrowRight size={15} />
            </Link>
          </div>
        </header>
        <main id="main-content">{children}</main>
        <footer className="jx-public-footer">
          <JobXLogo />
          <p>Karya nyata. Bukti yang bisa ditinjau. Peluang yang relevan.</p>
          <span>© {new Date().getFullYear()} JobX</span>
        </footer>
      </div>
    );

  return (
    <div className={`jx-app ${collapsed ? "is-collapsed" : ""}`}>
      <a className="jx-skip" href="#main-content">
        Lewati navigasi
      </a>
      {mobileOpen && (
        <button
          className="jx-scrim"
          aria-label="Tutup navigasi"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        className={`jx-sidebar ${mobileOpen ? "is-open" : ""}`}
        aria-label="Workspace"
      >
        <div className="jx-brand-row">
          <Link to={`/${role}/overview`} aria-label="JobX overview">
            <JobXLogo />
          </Link>
          <button
            className="jx-icon-button jx-collapse"
            aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            onClick={() => setCollapsed(!collapsed)}
          >
            <PanelLeftClose size={17} />
          </button>
          <button
            className="jx-icon-button jx-mobile-close"
            aria-label="Tutup navigasi"
            onClick={() => setMobileOpen(false)}
          >
            <X size={19} />
          </button>
        </div>
        <div className="jx-workspace-account">
          <span className="jx-avatar">{name.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>
              {role === "admin"
                ? "JobX Operations"
                : role === "employer"
                  ? "Company workspace"
                  : "Personal workspace"}
            </strong>
            <small>
              {role === "admin"
                ? "Administrator"
                : role === "employer"
                  ? "Employer account"
                  : "Candidate account"}
            </small>
          </div>
        </div>
        <Link
          className="jx-sidebar-search"
          to={
            role === "candidate"
              ? "/candidate/jobs"
              : role === "employer"
                ? "/employer/candidates"
                : "/admin/users"
          }
          onClick={() => setMobileOpen(false)}
        >
          <Search size={16} />
          <span>
            {role === "candidate"
              ? "Cari peluang kerja"
              : role === "employer"
                ? "Cari kandidat"
                : "Cari pengguna"}
          </span>
        </Link>
        <p className="jx-nav-caption">Workspace</p>
        <nav className="jx-nav" aria-label="Navigasi workspace">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `jx-nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="jx-sidebar-bottom">
          <div className="jx-sidebar-note">
            <Sparkles size={19} />
            <strong>Let your work speak.</strong>
            <p>
              Project kecil, potensi besar.
              <br />
              Mulai dari karya yang kamu punya.
            </p>
            <Link
              to={
                role === "candidate"
                  ? "/candidate/artifacts"
                  : role === "employer"
                    ? "/employer/create-job"
                    : "/admin/skills"
              }
            >
              Ambil langkah pertama <ArrowRight size={14} />
            </Link>
          </div>
          <p className="jx-nav-caption">Account</p>
          <NavLink
            className="jx-nav-item"
            to={`/${role}/settings`}
            onClick={() => setMobileOpen(false)}
          >
            <Settings2 size={18} />
            <span>Settings</span>
          </NavLink>
          <div className="jx-sidebar-user">
            <span className="jx-avatar">{name.slice(0, 2).toUpperCase()}</span>
            <span className="jx-user-name">
              <strong>{name}</strong>
              <small>{user?.email}</small>
            </span>
            <button
              className="jx-icon-button"
              title="Keluar dari browser ini"
              aria-label="Keluar dari browser ini"
              onClick={() => dispatch(clearSession())}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="jx-workspace">
        <header className="jx-topbar">
          <div className="jx-actions">
            <button
              ref={menuRef}
              className="jx-icon-button jx-mobile-menu"
              aria-label="Buka navigasi"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={19} />
            </button>
            <span className="jx-breadcrumb">
              {role === "employer"
                ? "Company workspace"
                : role === "admin"
                  ? "JobX Operations"
                  : "Personal workspace"}
              <span>/</span>
              <strong>{current}</strong>
            </span>
          </div>
          <span className="jx-topbar-note">
            <ShieldCheck size={14} /> Evidence-first workspace
          </span>
        </header>
        <main className="jx-main" id="main-content">
          {children}
        </main>
        <footer className="jx-workspace-footer">
          JobX · Keputusan tetap di tangan manusia.
        </footer>
      </div>
    </div>
  );
}
