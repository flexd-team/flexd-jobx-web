import type { ReactNode } from "react";
import { AlertCircle, FolderOpen, RefreshCw, Search } from "lucide-react";

export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="jx-page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className="jx-actions">{children}</div>}
    </div>
  );
}
export function ResourceState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  if (loading)
    return (
      <div className="jx-notice" role="status">
        <RefreshCw size={16} />
        Memuat data workspace…
      </div>
    );
  if (error)
    return (
      <div className="jx-notice error" role="alert">
        <AlertCircle size={17} />
        <div>
          <p>{error}</p>
          <button type="button" className="jx-button" onClick={retry}>
            Coba lagi
          </button>
        </div>
      </div>
    );
  return null;
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="jx-empty">
      <FolderOpen size={30} />
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function SearchField({
  value,
  onChange,
  placeholder = "Cari…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="jx-search">
      <Search size={15} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
export function StatusBadge({ value }: { value: string }) {
  const tone = [
    "completed",
    "candidate_confirmed",
    "reviewer_verified",
    "published",
    "accepted",
    "mutually_accepted",
    "active",
  ].includes(value)
    ? "mint"
    : ["failed", "rejected", "closed", "inactive"].includes(value)
      ? "rose"
      : [
            "queued",
            "processing",
            "needs_review",
            "pending",
            "draft",
            "ai_suggested",
          ].includes(value)
        ? "peach"
        : "lavender";
  return (
    <span className={`jx-badge ${tone}`}>{value.replaceAll("_", " ")}</span>
  );
}
