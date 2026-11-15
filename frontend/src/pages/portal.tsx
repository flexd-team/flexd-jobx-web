import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ExternalLink,
  FolderGit2,
  Heart,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api-client";
import { artifactTypeLabels, visibilityLabels } from "@/lib/portal-labels";
import { useAppSelector } from "@/hooks/use-app-selector";
import { usePortalResource } from "@/hooks/use-portal-resource";
import {
  EmptyState,
  PageHeading,
  ResourceState,
  SearchField,
  StatusBadge,
} from "@/components/portal-ui";
import { ArtifactEditor } from "@/components/artifact-editor";
import {
  artifact,
  artifactInput,
  artifactList,
  emptyEnvelope,
  envelope,
  evidenceList,
  jobList,
  matchList,
} from "@/schemas/portal";

const queued = envelope(
  z.object({
    artifact_analysis: z.object({
      id: z.string(),
      analysis_status: z.string(),
    }),
  }),
);
const reviewed = envelope(
  z.object({
    artifact_skill_evidence: z.object({
      id: z.string(),
      review_status: z.string(),
    }),
  }),
);
const calculated = envelope(
  z.object({ job_match: z.object({ id: z.string() }) }),
);
const analysis = envelope(
  z.object({
    artifact_analysis: z
      .object({
        analysis_status: z.string(),
        extracted_summary: z.string().nullable(),
        error_message: z.string().nullable(),
      })
      .nullable(),
  }),
);

export function OverviewPage() {
  const { accountType, user } = useAppSelector((s) => s.auth);
  const employer = accountType === "employer";
  const resource = usePortalResource(
    employer ? "/my/job-posts?limit=1" : "/my/artifacts?limit=1",
    employer ? jobList : artifactList,
  );
  const evidenceResource = usePortalResource(
    employer ? "/my/job-posts?limit=100" : "/my/skill-evidences",
    employer ? jobList : evidenceList,
  );
  const firstName = user?.name?.split(" ")[0] || "Anda";
  const role = employer ? "employer" : "candidate";
  const steps = employer
    ? [
        {
          title: "Kenalkan perusahaan Anda",
          text: "Beri kandidat konteks tentang tim dan pekerjaan.",
          path: "/employer/company",
        },
        {
          title: "Mulai dari kebutuhan bisnis",
          text: "Susun draft JD, tinjau skill, lalu tentukan publikasi.",
          path: "/employer/create-job",
        },
        {
          title: "Temukan kandidat berbasis bukti",
          text: "Tinjau kecocokan dan sampaikan ketertarikan.",
          path: "/employer/candidates",
        },
      ]
    : [
        {
          title: "Lengkapi profil Anda",
          text: "Ceritakan minat, pengalaman, dan preferensi kerja.",
          path: "/candidate/profile",
        },
        {
          title: "Tambahkan karya terbaik",
          text: "Hubungkan GitHub atau tambahkan tautan artifact.",
          path: "/candidate/artifacts",
        },
        {
          title: "Tinjau skill evidence",
          text: "Pastikan saran AI sesuai kontribusi Anda.",
          path: "/candidate/evidence",
        },
      ];
  const total = resource.data?.data.pagination.total;
  return (
    <>
      <PageHeading
        title={`Selamat datang, ${firstName}.`}
        description={
          employer
            ? "Dari kebutuhan bisnis ke kandidat yang relevan. Mulai dari bukti, bukan dugaan."
            : "Setiap karya punya cerita. Bangun profil kompetensi dari bukti yang bisa ditinjau."
        }
      />
      <div className="jx-overview-intro">
        <div>
          <h2>
            {employer
              ? "Kebutuhan yang jelas. Talenta yang tepat."
              : "Karyamu lebih dari sekadar daftar skill."}
          </h2>
          <p>
            {employer
              ? "Jelaskan masalah yang ingin diselesaikan. JobX membantu menyusun draft pekerjaan untuk Anda tinjau."
              : "Bawa project yang pernah kamu kerjakan. Tinjau evidence dan temukan peluang sesuai kompetensi yang ditunjukkan."}
          </p>
          <Link
            className="jx-button primary"
            to={employer ? "/employer/create-job" : "/candidate/artifacts"}
          >
            {employer ? "Buat pekerjaan" : "Tambahkan artifact"}
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className="jx-overview-art" aria-hidden="true">
          <div className="jx-paper">
            <FolderGit2 size={23} />
            <i />
            <i />
          </div>
          <div className="jx-paper">
            <ShieldCheck size={23} />
            <i />
            <i />
          </div>
        </div>
      </div>
      <ResourceState
        loading={resource.loading}
        error={resource.error}
        retry={resource.reload}
      />
      {evidenceResource.error && <ResourceState loading={false} error={evidenceResource.error} retry={evidenceResource.reload} />}
      <div className="jx-stat-grid">
        <div className="jx-stat">
          <div>
            <strong>{total ?? "—"}</strong>
            <span>{employer ? "Pekerjaan Anda" : "Artifact tersimpan"}</span>
          </div>
          <FolderGit2 size={20} />
        </div>
        <div className="jx-stat">
          <div>
            <strong>
              {evidenceResource.data &&
              "artifact_skill_evidences" in evidenceResource.data.data
                ? evidenceResource.data.data.artifact_skill_evidences.length
                : evidenceResource.data && "job_posts" in evidenceResource.data.data
                  ? evidenceResource.data.data.job_posts.filter((item) => item.status === "draft").length
                  : "—"}
            </strong>
            <span>
              {employer
                ? "Draft dalam 100 pekerjaan pertama"
                : "Skill evidence tersedia"}
            </span>
          </div>
          <Sparkles size={20} />
        </div>
        <Link className="jx-stat" to={`/${role}/matches`}>
          <div>
            <strong>
              <ArrowRight size={25} />
            </strong>
            <span>Tinjau keputusan kedua pihak</span>
          </div>
          <Heart size={20} />
        </Link>
      </div>
      <h2 className="jx-section-title">Langkah berikutnya</h2>
      <div className="jx-step-list">
        {steps.map((step, index) => (
          <div className="jx-step-row" key={step.path}>
            <span>{index + 1}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </div>
            <Link className="jx-button" to={step.path}>
              Buka <ArrowRight size={13} />
            </Link>
          </div>
        ))}
      </div>
      <div className="jx-notice lavender">
        <ShieldCheck size={18} />
        <p>
          AI membantu membaca evidence, bukan menetapkan kemampuan atau
          keputusan rekrutmen. Data yang belum tersedia tidak dihitung sebagai
          kekurangan kemampuan.
        </p>
      </div>
    </>
  );
}

export function ArtifactsPage() {
  const token = useAppSelector((s) => s.auth.token);
  const [offset, setOffset] = useState(0);
  const resource = usePortalResource(
    `/my/artifacts?limit=20&offset=${offset}`,
    artifactList,
  );
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const form = useForm<z.infer<typeof artifactInput>>({
    resolver: zodResolver(artifactInput),
    defaultValues: {
      title: "",
      source_url: "",
      description: "",
      artifact_type: "github_repository",
      visibility: "private",
    },
  });
  async function act(id: string, action: "analyze" | "delete" | "analysis") {
    if (
      action === "delete" &&
      !window.confirm(
        "Hapus artifact beserta data terkait? Tindakan tidak dapat dibatalkan.",
      )
    )
      return;
    if (
      action === "analyze" &&
      !window.confirm(
        "Kirim konten artifact ke model AI yang dikonfigurasi? Pastikan konten boleh dibagikan dan tidak mengandung secret.",
      )
    )
      return;
    setBusy(id);
    setError("");
    setNotice("");
    try {
      if (action === "analysis") {
        const result = await apiRequest(`/artifacts/${id}/analysis`, analysis, {
          token: token!,
        });
        setNotice(
          result.data.artifact_analysis
            ? `${result.data.artifact_analysis.analysis_status}: ${result.data.artifact_analysis.extracted_summary || result.data.artifact_analysis.error_message || "Analisis belum menghasilkan ringkasan."}`
            : "Belum ada analisis.",
        );
      } else if (action === "delete") {
        await apiRequest(`/my/artifacts/${id}`, emptyEnvelope, {
          method: "DELETE",
          token: token!,
        });
        resource.reload();
      } else {
        await apiRequest(`/artifacts/${id}/analyze`, queued, {
          method: "POST",
          token: token!,
        });
        setNotice(
          "Analisis masuk antrean. Gunakan Perbarui untuk melihat status terbaru.",
        );
        resource.reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operasi gagal.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <PageHeading
        title="Smart Artifacts"
        description="Kumpulan karya yang menunjukkan bagaimana kamu menerapkan skill. Atur visibilitas dan tinjau hasil analisisnya."
      >
        <Link className="jx-button" to="/github">
          <FolderGit2 size={15} />
          Import GitHub
        </Link>
        <button
          className="jx-button primary"
          onClick={() => setAdding(!adding)}
        >
          <Plus size={15} />
          Tambah artifact
        </button>
      </PageHeading>
      {adding && (
        <form
          className="jx-form"
          onSubmit={form.handleSubmit(async (values) => {
            setError("");
            try {
              await apiRequest(
                "/my/artifacts",
                envelope(z.object({ artifact })),
                { method: "POST", token: token!, body: values },
              );
              form.reset();
              setAdding(false);
              resource.reload();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Artifact gagal disimpan.",
              );
            }
          })}
        >
          <h2>Tambahkan tautan karya</h2>
          <div className="jx-form-grid">
            <label className="jx-field">
              Judul
              <input className="jx-input" {...form.register("title")} />
              {form.formState.errors.title && (
                <span role="alert">{form.formState.errors.title.message}</span>
              )}
            </label>
            <label className="jx-field">
              URL sumber
              <input
                className="jx-input"
                type="url"
                placeholder="https://github.com/owner/repository"
                {...form.register("source_url")}
              />
              {form.formState.errors.source_url && (
                <span role="alert">
                  {form.formState.errors.source_url.message}
                </span>
              )}
            </label>
            <label className="jx-field">
              Jenis karya
              <select className="jx-input" {...form.register("artifact_type")}>
                {artifactInput.shape.artifact_type.options.map((value) => (
                  <option key={value} value={value}>{artifactTypeLabels[value]}</option>
                ))}
              </select>
            </label>
            <label className="jx-field">
              Visibilitas
              <select className="jx-input" {...form.register("visibility")}>
                {artifactInput.shape.visibility.options.map((value) => (
                  <option key={value} value={value}>{visibilityLabels[value]}</option>
                ))}
              </select>
            </label>
            <label className="jx-field full">
              Deskripsi karya
              <textarea
                className="jx-input"
                {...form.register("description")}
              />
              <small>
                Deskripsikan project. Klaim kontribusi tidak otomatis
                membuktikan kepemilikan seluruh project.
              </small>
            </label>
          </div>
          <div className="jx-actions">
            <button
              className="jx-button primary"
              disabled={form.formState.isSubmitting}
            >
              Simpan artifact
            </button>
            <button
              className="jx-button"
              type="button"
              onClick={() => setAdding(false)}
            >
              Batal
            </button>
          </div>
        </form>
      )}
      <div className="jx-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Cari artifact di halaman ini…"
        />
        <button className="jx-button" onClick={resource.reload}>
          <RefreshCw size={14} />
          Perbarui
        </button>
      </div>
      <ResourceState {...resource} retry={resource.reload} />
      {error && (
        <div role="alert" className="jx-notice error">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="jx-notice lavender">
          {notice}
        </div>
      )}
      {!resource.loading &&
        !resource.error &&
        !resource.data?.data.artifacts.length && (
          <EmptyState title="Karya pertama membuka cerita baru.">
            <p>
              Import repository publik atau tambahkan tautan karya yang boleh
              Anda bagikan.
            </p>
          </EmptyState>
        )}
      <div className="jx-grid">
        {resource.data?.data.artifacts
          .filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase()),
          )
          .map((item) => (
            <article className="jx-record" key={item.id}>
              <div className="jx-record-top">
                <span className="jx-record-icon">
                  <FolderGit2 size={20} />
                </span>
                <StatusBadge value={item.processing_status} />
              </div>
              <h2>{item.title}</h2>
              <p>{item.description || "Belum ada deskripsi karya."}</p>
              <div className="jx-record-footer">
                <StatusBadge value={item.visibility} />
                <span>{item.artifact_type.replaceAll("_", " ")}</span>
              </div>
              <div className="jx-actions">
                {item.source_url && /^https?:\/\//.test(item.source_url) && (
                  <a
                    className="jx-button"
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Sumber
                    <ExternalLink size={13} />
                  </a>
                )}
                <button
                  className="jx-button"
                  disabled={
                    busy === item.id ||
                    ["queued", "processing"].includes(item.processing_status)
                  }
                  onClick={() => void act(item.id, "analyze")}
                >
                  <Sparkles size={14} />
                  Analisis
                </button>
                <button
                  className="jx-button"
                  disabled={busy === item.id}
                  onClick={() => void act(item.id, "analysis")}
                >
                  Hasil
                </button>
                <button
                  className="jx-icon-button"
                  disabled={busy === item.id}
                  aria-label={`Hapus ${item.title}`}
                  onClick={() => void act(item.id, "delete")}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <ArtifactEditor item={item} reload={resource.reload} />
            </article>
          ))}
      </div>
      {resource.data && (
        <div className="jx-pagination">
          <button
            className="jx-button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 20))}
          >
            Sebelumnya
          </button>
          <span>{resource.data.data.pagination.total} artifact</span>
          <button
            className="jx-button"
            disabled={offset + 20 >= resource.data.data.pagination.total}
            onClick={() => setOffset(offset + 20)}
          >
            Berikutnya
          </button>
        </div>
      )}
    </>
  );
}

export function EvidencePage() {
  const token = useAppSelector((s) => s.auth.token);
  const resource = usePortalResource("/my/skill-evidences", evidenceList);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <>
      <PageHeading
        title="Skill Evidence"
        description="Bukan sekadar klaim. Tinjau sumber, konteks, dan saran skill dari karya Anda."
      />
      <div className="jx-notice lavender">
        <Sparkles size={17} />
        <p>
          Confidence adalah keyakinan identifikasi AI, bukan ukuran kemampuan.
          Direct menunjukkan bukti langsung; inferred merupakan kesimpulan yang
          perlu ditinjau.
        </p>
      </div>
      <div className="jx-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Cari skill…"
        />
        <select
          className="jx-input"
          aria-label="Filter review evidence"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">Semua status review</option>
          {[
            "ai_suggested",
            "candidate_confirmed",
            "reviewer_verified",
            "rejected",
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
      <ResourceState {...resource} retry={resource.reload} />
      {error && (
        <div className="jx-notice error" role="alert">
          {error}
        </div>
      )}
      {resource.data && !resource.data.data.artifact_skill_evidences.length && (
        <EmptyState title="Evidence belum tersedia.">
          <p>
            Tambahkan artifact dan jalankan analisis untuk mulai meninjau saran
            skill.
          </p>
          <Link className="jx-button" to="/candidate/artifacts">
            Buka artifacts
          </Link>
        </EmptyState>
      )}
      <div className="jx-grid">
        {resource.data?.data.artifact_skill_evidences
          .filter(
            (item) =>
              item.skill_name.toLowerCase().includes(query.toLowerCase()) &&
              (status === "all" || item.review_status === status),
          )
          .map((item) => (
            <article className="jx-record" key={item.id}>
              <div className="jx-record-top">
                <span className="jx-badge lavender">{item.evidence_kind}</span>
                <StatusBadge value={item.review_status} />
              </div>
              <h2>{item.skill_name}</h2>
              <p>
                Confidence identifikasi:{" "}
                {(Number(item.confidence_score) * 100).toFixed(0)}%
              </p>
              <pre className="jx-code">
                {item.evidence_excerpt ||
                  "Tidak ada kutipan teks; periksa lokasi sumber."}
              </pre>
              <p>{item.evidence_location || "Lokasi sumber tidak tersedia"}</p>
              {item.review_status !== "reviewer_verified" && (
                <div className="jx-actions">
                  {(["candidate_confirmed", "rejected"] as const).map(
                    (review_status) => (
                      <button
                        key={review_status}
                        className={`jx-button ${review_status === "candidate_confirmed" ? "primary" : ""}`}
                        disabled={
                          busy === item.id ||
                          item.review_status === review_status
                        }
                        onClick={async () => {
                          setBusy(item.id);
                          setError("");
                          try {
                            await apiRequest(
                              `/artifact-skill-evidences/${item.id}/review`,
                              reviewed,
                              {
                                method: "PATCH",
                                token: token!,
                                body: { review_status },
                              },
                            );
                            resource.reload();
                          } catch (err) {
                            setError(
                              err instanceof Error
                                ? err.message
                                : "Review gagal.",
                            );
                          } finally {
                            setBusy(null);
                          }
                        }}
                      >
                        {review_status === "candidate_confirmed" ? (
                          <>
                            <Check size={13} />
                            Konfirmasi
                          </>
                        ) : (
                          "Tolak saran"
                        )}
                      </button>
                    ),
                  )}
                </div>
              )}
            </article>
          ))}
      </div>
    </>
  );
}

export function FindJobsPage() {
  const token = useAppSelector((s) => s.auth.token);
  const [offset, setOffset] = useState(0);
  const resource = usePortalResource(
    `/jobs/published?limit=20&offset=${offset}`,
    jobList,
  );
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <>
      <PageHeading
        title="Find Jobs"
        description="Temukan kebutuhan yang relevan dengan karya Anda. Hitung kecocokan dari evidence yang tersedia."
      />
      <div className="jx-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Cari pekerjaan di halaman ini…"
        />
        <Link className="jx-button" to="/candidate/matches">
          My Matches
          <ArrowRight size={14} />
        </Link>
      </div>
      <ResourceState {...resource} retry={resource.reload} />
      {notice && (
        <div className="jx-notice" role="status">
          {notice}
        </div>
      )}
      {resource.data && !resource.data.data.job_posts.length && (
        <EmptyState title="Belum ada pekerjaan terpublikasi.">
          <p>Periksa kembali nanti untuk peluang baru.</p>
        </EmptyState>
      )}
      <div className="jx-grid">
        {resource.data?.data.job_posts
          .filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase()),
          )
          .map((item) => (
            <article className="jx-record" key={item.id}>
              <div className="jx-record-top">
                <span className="jx-record-icon">
                  <FolderGit2 size={19} />
                </span>
                <StatusBadge value={item.status} />
              </div>
              <h2>{item.title}</h2>
              <div className="jx-record-footer">
                <span>{item.city || item.country}</span>
                <span>{item.work_mode}</span>
                <span>{item.employment_type.replaceAll("_", " ")}</span>
              </div>
              <p>{item.job_summary || item.business_problem}</p>
              <details className="jx-detail">
                <summary>Detail pekerjaan</summary>
                <p style={{ whiteSpace: "pre-wrap" }}>
                  {item.job_description || "Deskripsi belum tersedia."}
                </p>
                {item.salary_min && (
                  <p>
                    {item.currency}{" "}
                    {BigInt(item.salary_min).toLocaleString("id-ID")}
                    {item.salary_max
                      ? ` – ${BigInt(item.salary_max).toLocaleString("id-ID")}`
                      : ""}
                  </p>
                )}
              </details>
              <div className="jx-actions">
                <button
                  className="jx-button primary"
                  disabled={busy === item.id}
                  onClick={async () => {
                    setBusy(item.id);
                    try {
                      await apiRequest(
                        `/job-posts/${item.id}/match`,
                        calculated,
                        { method: "POST", token: token! },
                      );
                      setNotice(
                        "Kecocokan tersimpan. Buka My Matches untuk melihat skor dan alasan.",
                      );
                    } catch (err) {
                      setNotice(
                        err instanceof Error ? err.message : "Matching gagal.",
                      );
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <Sparkles size={14} />
                  {busy === item.id ? "Menghitung…" : "Hitung kecocokan"}
                </button>
              </div>
            </article>
          ))}
      </div>
      {resource.data && (
        <div className="jx-pagination">
          <button
            className="jx-button"
            disabled={!offset}
            onClick={() => setOffset(Math.max(0, offset - 20))}
          >
            Sebelumnya
          </button>
          <span>{resource.data.data.pagination.total} pekerjaan</span>
          <button
            className="jx-button"
            disabled={offset + 20 >= resource.data.data.pagination.total}
            onClick={() => setOffset(offset + 20)}
          >
            Berikutnya
          </button>
        </div>
      )}
    </>
  );
}

export function MatchesPage() {
  const token = useAppSelector((s) => s.auth.token);
  const resource = usePortalResource("/my/job-matches", matchList);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <>
      <PageHeading
        title="My Matches"
        description="Ketertarikan berjalan dua arah. Skor menunjukkan relevansi informasi, bukan peluang diterima."
      />
      <ResourceState {...resource} retry={resource.reload} />
      {error && (
        <div className="jx-notice error" role="alert">
          {error}
        </div>
      )}
      {resource.data && !resource.data.data.job_matches.length && (
        <EmptyState title="Belum ada kecocokan tersimpan.">
          <p>
            Hitung kecocokan pada pekerjaan yang menarik untuk melihat alasan
            dan evidence pendukung.
          </p>
          <Link className="jx-button primary" to="/candidate/jobs">
            Temukan pekerjaan
          </Link>
        </EmptyState>
      )}
      <div className="jx-grid">
        {resource.data?.data.job_matches.map((item) => (
          <article className="jx-record" key={item.id}>
            <div className="jx-record-top">
              <StatusBadge value={item.match_status} />
              <span className="jx-score">
                {Number(item.match_score).toFixed(1)}
              </span>
            </div>
            <h2>{item.job_title}</h2>
            <p>{item.company_name}</p>
            <p>{item.explanation || "Penjelasan belum tersedia."}</p>
            <div className="jx-record-footer">
              <span>
                Anda: <StatusBadge value={item.candidate_decision} />
              </span>
              <span>
                Employer: <StatusBadge value={item.employer_decision} />
              </span>
            </div>
            {item.score_breakdown && (
              <details className="jx-detail">
                <summary>Rincian kecocokan</summary>
                <dl>
                  {Object.entries(item.score_breakdown).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key.replaceAll("_", " ")}</dt>
                      <dd>
                        {typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
            <div className="jx-actions">
              {(["accepted", "rejected"] as const).map((decision) => (
                <button
                  key={decision}
                  className={`jx-button ${decision === "accepted" ? "primary" : ""}`}
                  disabled={
                    busy === item.id || item.candidate_decision === decision
                  }
                  onClick={async () => {
                    setBusy(item.id);
                    setError("");
                    try {
                      await apiRequest(
                        `/job-matches/${item.id}/decision`,
                        calculated,
                        { method: "POST", token: token!, body: { decision } },
                      );
                      resource.reload();
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Keputusan gagal disimpan.",
                      );
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {decision === "accepted" ? (
                    <>
                      <Heart size={14} />
                      Tertarik
                    </>
                  ) : (
                    "Tidak tertarik"
                  )}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
