import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  Heart,
  Plus,
  Sparkles,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePortalResource } from "@/hooks/use-portal-resource";
import { useAppSelector } from "@/hooks/use-app-selector";
import { apiRequest } from "@/lib/api-client";
import {
  EmptyState,
  PageHeading,
  ResourceState,
  SearchField,
  StatusBadge,
} from "@/components/portal-ui";
import { envelope, job, jobInput, jobList, skill } from "@/schemas/portal";

const skillList = envelope(z.object({ skills: z.array(skill) }));
const savedJob = envelope(z.object({ job_post: job }));
const draftSchema = envelope(
  z.object({
    job_draft: z.object({
      draft: z.object({
        suggested_title: z.string(),
        job_summary: z.string(),
        job_description: z.string(),
        requirements: z.array(
          z.object({
            skill_id: z.string(),
            requirement_type: z.enum(["must_have", "preferred"]),
            weight: z.string(),
          }),
        ),
      }),
      limitations: z.array(z.string()),
    }),
  }),
);
const candidatesSchema = envelope(
  z.object({
    matches: z.array(
      z.object({
        match: z.object({
          id: z.string(),
          match_score: z.string(),
          explanation: z.string().nullable(),
          candidate_decision: z.string(),
          employer_decision: z.string(),
          match_status: z.string(),
        }),
        candidate: z.object({
          id: z.string(),
          name: z.string(),
          headline: z.string().nullable(),
          city: z.string().nullable(),
          email: z.string().nullable(),
        }),
        evidence: z.array(
          z.object({
            id: z.string(),
            evidence_excerpt: z.string().nullable(),
            evidence_location: z.string().nullable(),
            review_status: z.string(),
          }),
        ),
      }),
    ),
  }),
);
const decisionSchema = envelope(
  z.object({ job_match: z.object({ id: z.string() }) }),
);

export function CreateJobPage() {
  const token = useAppSelector((s) => s.auth.token);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [limitations, setLimitations] = useState<string[]>([]);
  const [requirements, setRequirements] = useState<
    {
      skill_id: string;
      requirement_type: "must_have" | "preferred";
      weight: string;
    }[]
  >([]);
  const [approved, setApproved] = useState(false);
  const skills = usePortalResource("/catalog/skills", skillList);
  const form = useForm<z.infer<typeof jobInput>>({
    resolver: zodResolver(jobInput),
    defaultValues: {
      title: "",
      business_problem: "",
      job_summary: "",
      job_description: "",
      employment_type: "full_time",
      work_mode: "remote",
      city: "",
      country: "Indonesia",
      salary_min: "",
      salary_max: "",
    },
  });
  async function generate() {
    if (!(await form.trigger("business_problem"))) return;
    setGenerating(true);
    setError("");
    try {
      const result = await apiRequest(
        "/jobs/generate-description",
        draftSchema,
        {
          method: "POST",
          token: token!,
          body: { business_problem: form.getValues("business_problem") },
        },
      );
      form.setValue("title", result.data.job_draft.draft.suggested_title);
      form.setValue("job_summary", result.data.job_draft.draft.job_summary);
      form.setValue(
        "job_description",
        result.data.job_draft.draft.job_description,
      );
      setRequirements(result.data.job_draft.draft.requirements);
      setLimitations(result.data.job_draft.limitations);
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draft gagal dibuat.");
    } finally {
      setGenerating(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Create Job"
        description="Mulai dari masalah bisnis. Susun kebutuhan, tinjau draft, lalu tentukan kapan pekerjaan siap dipublikasikan."
      />
      <div className="jx-stepper">
        {["Kebutuhan bisnis", "Edit draft", "Review & simpan"].map(
          (label, index) => (
            <span key={label} className={index === step ? "active" : ""}>
              {index + 1}. {label}
            </span>
          ),
        )}
      </div>
      <form
        className="jx-form"
        onSubmit={form.handleSubmit(async (values) => {
          setError("");
          try {
            await apiRequest("/my/job-posts", savedJob, {
              method: "POST",
              token: token!,
              body: {
                ...values,
                salary_min: values.salary_min || null,
                salary_max: values.salary_max || null,
                requirements,
                status: "draft",
              },
            });
            navigate("/employer/my-jobs");
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Pekerjaan gagal disimpan.",
            );
          }
        })}
      >
        {step === 0 && (
          <>
            <h2>Apa yang ingin tim Anda selesaikan?</h2>
            <label className="jx-field">
              Business problem
              <textarea
                className="jx-input"
                rows={7}
                placeholder="Ceritakan masalah, konteks tim, dan hasil yang diharapkan…"
                {...form.register("business_problem")}
              />
              {form.formState.errors.business_problem && (
                <span role="alert">
                  {form.formState.errors.business_problem.message}
                </span>
              )}
              <small>
                Jangan masukkan informasi rahasia. Generate draft akan mengirim
                konteks ke model yang dikonfigurasi.
              </small>
            </label>
            <div className="jx-actions">
              <button
                className="jx-button primary"
                type="button"
                disabled={generating}
                onClick={() => void generate()}
              >
                <Sparkles size={15} />
                {generating ? "Menyusun draft…" : "Generate draft"}
              </button>
              <button
                className="jx-button"
                type="button"
                onClick={async () => {
                  if (await form.trigger("business_problem")) setStep(1);
                }}
              >
                Tulis manual
                <ArrowRight size={14} />
              </button>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h2>Jadikan draft sesuai kebutuhan nyata.</h2>
            {limitations.length > 0 && (
              <div className="jx-notice lavender">
                <p>Batas hasil: {limitations.join(" ")}</p>
              </div>
            )}
            <div className="jx-form-grid">
              <label className="jx-field full">
                Judul pekerjaan
                <input className="jx-input" {...form.register("title")} />
                {form.formState.errors.title && (
                  <span role="alert">
                    {form.formState.errors.title.message}
                  </span>
                )}
              </label>
              <label className="jx-field full">
                Ringkasan
                <textarea
                  className="jx-input"
                  {...form.register("job_summary")}
                />
              </label>
              <label className="jx-field full">
                Deskripsi, tanggung jawab, dan kualifikasi
                <textarea
                  className="jx-input"
                  rows={9}
                  {...form.register("job_description")}
                />
              </label>
              <label className="jx-field">
                Jenis pekerjaan
                <select
                  className="jx-input"
                  {...form.register("employment_type")}
                >
                  {[
                    "full_time",
                    "part_time",
                    "contract",
                    "internship",
                    "freelance",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="jx-field">
                Mode kerja
                <select className="jx-input" {...form.register("work_mode")}>
                  {["onsite", "hybrid", "remote"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="jx-field">
                Kota
                <input className="jx-input" {...form.register("city")} />
              </label>
              <label className="jx-field">
                Negara
                <input className="jx-input" {...form.register("country")} />
              </label>
              <label className="jx-field">
                Gaji minimum (IDR)
                <input
                  className="jx-input"
                  inputMode="numeric"
                  {...form.register("salary_min")}
                />
                <span role="alert">
                  {form.formState.errors.salary_min?.message}
                </span>
              </label>
              <label className="jx-field">
                Gaji maksimum (IDR)
                <input
                  className="jx-input"
                  inputMode="numeric"
                  {...form.register("salary_max")}
                />
                <span role="alert">
                  {form.formState.errors.salary_max?.message}
                </span>
              </label>
            </div>
            <h3 className="jx-section-title">Kebutuhan skill</h3>
            <ResourceState {...skills} retry={skills.reload} />
            {skills.data?.data.skills.map((item) => {
              const selected = requirements.find(
                (req) => req.skill_id === item.id,
              );
              return (
                <div className="jx-step-row" key={item.id}>
                  <label className="jx-actions">
                    <input
                      type="checkbox"
                      checked={!!selected}
                      onChange={(event) =>
                        setRequirements((previous) =>
                          event.target.checked
                            ? [
                                ...previous,
                                {
                                  skill_id: item.id,
                                  requirement_type: "must_have",
                                  weight: "1.0",
                                },
                              ]
                            : previous.filter(
                                (req) => req.skill_id !== item.id,
                              ),
                        )
                      }
                    />
                    {item.canonical_name}
                  </label>
                  {selected && (
                    <select
                      className="jx-input"
                      style={{ maxWidth: 160, marginLeft: "auto" }}
                      aria-label={`Jenis kebutuhan ${item.canonical_name}`}
                      value={selected.requirement_type}
                      onChange={(event) =>
                        setRequirements((previous) =>
                          previous.map((req) =>
                            req.skill_id === item.id
                              ? {
                                  ...req,
                                  requirement_type: event.target.value as
                                    "must_have" | "preferred",
                                }
                              : req,
                          ),
                        )
                      }
                    >
                      <option value="must_have">Must-have</option>
                      <option value="preferred">Preferred</option>
                    </select>
                  )}
                </div>
              );
            })}
            <div className="jx-actions">
              <button
                type="button"
                className="jx-button"
                onClick={() => setStep(0)}
              >
                Kembali
              </button>
              <button
                type="button"
                className="jx-button primary"
                onClick={async () => {
                  if (await form.trigger()) setStep(2);
                }}
              >
                Review draft
                <ArrowRight size={14} />
              </button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2>{form.getValues("title")}</h2>
            <p className="jx-muted">
              {form.getValues("employment_type")} ·{" "}
              {form.getValues("work_mode")} ·{" "}
              {form.getValues("city") || form.getValues("country")}
            </p>
            <p style={{ whiteSpace: "pre-wrap", margin: "20px 0" }}>
              {form.getValues("job_summary")}
            </p>
            <pre className="jx-code">
              {form.getValues("job_description") || "Belum ada deskripsi."}
            </pre>
            <div className="jx-actions">
              {requirements.map((req) => (
                <span className="jx-badge lavender" key={req.skill_id}>
                  {skills.data?.data.skills.find(
                    (item) => item.id === req.skill_id,
                  )?.canonical_name || `Skill ${req.skill_id}`}{" "}
                  · {req.requirement_type}
                </span>
              ))}
            </div>
            <div className="jx-notice">
              <p>
                Disimpan sebagai draft, bukan dipublikasikan otomatis. Aturan
                approval publikasi harus dipenuhi sebelum lowongan tersedia bagi
                kandidat.
              </p>
            </div>
            <label className="jx-actions">
              <input
                type="checkbox"
                checked={approved}
                onChange={(event) => setApproved(event.target.checked)}
              />
              Saya sudah meninjau isi dan kebutuhan skill.
            </label>
            <div className="jx-actions">
              <button
                className="jx-button"
                type="button"
                onClick={() => setStep(1)}
              >
                Edit lagi
              </button>
              <button
                className="jx-button primary"
                disabled={!approved || form.formState.isSubmitting}
              >
                Simpan draft
              </button>
            </div>
          </>
        )}
        {error && (
          <div className="jx-notice error" role="alert">
            {error}
          </div>
        )}
      </form>
    </>
  );
}

export function MyJobsPage() {
  const resource = usePortalResource("/my/job-posts?limit=100", jobList);
  const [query, setQuery] = useState("");
  return (
    <>
      <PageHeading
        title="My Jobs"
        description="Kebutuhan tim, draft pekerjaan, dan status publikasi dalam satu tempat."
      >
        <Link className="jx-button primary" to="/employer/create-job">
          <Plus size={14} />
          Buat pekerjaan
        </Link>
      </PageHeading>
      <div className="jx-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Cari pekerjaan…"
        />
      </div>
      <ResourceState {...resource} retry={resource.reload} />
      {resource.data && !resource.data.data.job_posts.length && (
        <EmptyState title="Mulai dari kebutuhan tim Anda.">
          <p>Buat draft pekerjaan pertama, lalu tinjau sebelum publikasi.</p>
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
                  <BriefcaseBusiness size={20} />
                </span>
                <StatusBadge value={item.status} />
              </div>
              <h2>{item.title}</h2>
              <p>{item.job_summary || item.business_problem}</p>
              <div className="jx-record-footer">
                <span>{item.work_mode}</span>
                <span>{item.employment_type}</span>
              </div>
              <details className="jx-detail">
                <summary>Tinjau deskripsi</summary>
                <pre className="jx-code">
                  {item.job_description || "Belum ada deskripsi."}
                </pre>
              </details>
              <div className="jx-actions">
                <Link
                  className="jx-button"
                  to={`/employer/candidates?job=${item.id}`}
                >
                  Lihat kandidat
                  <ArrowRight size={13} />
                </Link>
              </div>
            </article>
          ))}
      </div>
      {resource.data && resource.data.data.pagination.total > 100 && (
        <p className="jx-muted">
          Menampilkan 100 pekerjaan pertama dari{" "}
          {resource.data.data.pagination.total}.
        </p>
      )}
    </>
  );
}

export function CandidatesPage({
  matchesOnly = false,
}: {
  matchesOnly?: boolean;
}) {
  const jobs = usePortalResource("/my/job-posts?limit=100", jobList);
  const [selected, setSelected] = useState(
    new URLSearchParams(window.location.search).get("job") || "",
  );
  return (
    <>
      <PageHeading
        title={matchesOnly ? "Matches" : "Find Candidates"}
        description="Pilih pekerjaan untuk meninjau kandidat yang sudah memiliki kecocokan tersimpan. Akses evidence mengikuti visibilitas artifact."
      />
      <ResourceState {...jobs} retry={jobs.reload} />
      <label className="jx-field" style={{ maxWidth: 440, marginBottom: 24 }}>
        Pekerjaan
        <select
          className="jx-input"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">Pilih pekerjaan…</option>
          {jobs.data?.data.job_posts.map((item) => (
            <option value={item.id} key={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <CandidateResults key={selected} jobId={selected} />
      ) : (
        <EmptyState title="Pilih pekerjaan untuk mulai meninjau.">
          <p>
            Rekomendasi yang belum dihitung tidak ditampilkan sebagai kandidat
            contoh.
          </p>
        </EmptyState>
      )}
    </>
  );
}

function CandidateResults({ jobId }: { jobId: string }) {
  const token = useAppSelector((s) => s.auth.token);
  const resource = usePortalResource(
    `/job-posts/${jobId}/matches`,
    candidatesSchema,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <>
      <ResourceState {...resource} retry={resource.reload} />
      {error && (
        <div className="jx-notice error" role="alert">
          {error}
        </div>
      )}
      {resource.data && !resource.data.data.matches.length && (
        <EmptyState title="Belum ada kandidat dengan match tersimpan.">
          <p>
            Kandidat perlu menghitung kecocokan terhadap pekerjaan ini terlebih
            dahulu.
          </p>
        </EmptyState>
      )}
      <div className="jx-grid">
        {resource.data?.data.matches.map((item) => (
          <article className="jx-record" key={item.match.id}>
            <div className="jx-record-top">
              <StatusBadge value={item.match.match_status} />
              <span className="jx-score">
                {Number(item.match.match_score).toFixed(1)}
              </span>
            </div>
            <h2>{item.candidate.name}</h2>
            <p>{item.candidate.headline || "Headline belum tersedia."}</p>
            <p>{item.match.explanation}</p>
            <div className="jx-record-footer">
              <span>
                Kandidat: <StatusBadge value={item.match.candidate_decision} />
              </span>
              <span>
                Anda: <StatusBadge value={item.match.employer_decision} />
              </span>
            </div>
            <details className="jx-detail">
              <summary>
                Evidence yang dibagikan ({item.evidence.length})
              </summary>
              {item.evidence.map((ev) => (
                <div key={ev.id}>
                  <pre className="jx-code">{ev.evidence_excerpt}</pre>
                  <p>
                    {ev.evidence_location} · {ev.review_status}
                  </p>
                </div>
              ))}
              {item.candidate.email && <p>Kontak: {item.candidate.email}</p>}
            </details>
            <div className="jx-actions">
              {(["accepted", "rejected"] as const).map((decision) => (
                <button
                  className={`jx-button ${decision === "accepted" ? "primary" : ""}`}
                  key={decision}
                  disabled={
                    busy === item.match.id ||
                    item.match.employer_decision === decision
                  }
                  onClick={async () => {
                    setBusy(item.match.id);
                    setError("");
                    try {
                      await apiRequest(
                        `/job-matches/${item.match.id}/decision`,
                        decisionSchema,
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
                      <Heart size={13} />
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
