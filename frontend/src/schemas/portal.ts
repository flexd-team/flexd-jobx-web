import { z } from "zod";

export const pagination = z.object({
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});
export const envelope = <T extends z.ZodType>(data: T) => z.object({ data });
export const artifact = z.object({
  id: z.string(),
  title: z.string(),
  artifact_type: z.string(),
  description: z.string().nullable(),
  source_url: z.string().nullable(),
  visibility: z.string(),
  processing_status: z.string(),
});
export const evidence = z.object({
  id: z.string(),
  artifact_id: z.string(),
  skill_id: z.string(),
  skill_name: z.string(),
  evidence_kind: z.string(),
  evidence_excerpt: z.string().nullable(),
  evidence_location: z.string().nullable(),
  confidence_score: z.string(),
  review_status: z.string(),
});
export const job = z.object({
  id: z.string(),
  title: z.string(),
  business_problem: z.string(),
  job_summary: z.string().nullable(),
  job_description: z.string().nullable(),
  employment_type: z.string(),
  work_mode: z.string(),
  city: z.string().nullable(),
  country: z.string(),
  salary_min: z.string().nullable(),
  salary_max: z.string().nullable(),
  currency: z.string(),
  status: z.string(),
});
export const match = z.object({
  id: z.string(),
  job_id: z.string(),
  job_title: z.string(),
  company_name: z.string(),
  match_score: z.string(),
  explanation: z.string().nullable(),
  candidate_decision: z.string(),
  employer_decision: z.string(),
  match_status: z.string(),
  score_breakdown: z.record(z.string(), z.unknown()).nullable(),
});
export const skill = z.object({
  id: z.string(),
  canonical_name: z.string(),
  category: z.string().nullable(),
});
export const artifactList = envelope(
  z.object({ artifacts: z.array(artifact), pagination }),
);
export const evidenceList = envelope(
  z.object({ artifact_skill_evidences: z.array(evidence) }),
);
export const jobList = envelope(
  z.object({ job_posts: z.array(job), pagination }),
);
export const matchList = envelope(z.object({ job_matches: z.array(match) }));
export const emptyEnvelope = envelope(z.object({}));
export const artifactInput = z.object({
  title: z.string().trim().min(1, "Judul wajib diisi.").max(200),
  source_url: z
    .url("URL sumber tidak valid.")
    .refine((url) => /^https?:\/\//.test(url), "Gunakan HTTP atau HTTPS."),
  description: z.string().max(10000),
  artifact_type: z.enum([
    "github_repository",
    "document",
    "spreadsheet",
    "image",
    "video",
    "design_link",
    "other",
  ]),
  visibility: z.enum(["private", "unlisted", "matching_employers", "public"]),
});
export const jobInput = z
  .object({
    title: z.string().trim().min(1, "Judul wajib diisi.").max(200),
    business_problem: z.string().trim().min(1, "Kebutuhan bisnis wajib diisi."),
    job_summary: z.string(),
    job_description: z.string(),
    employment_type: z.enum([
      "full_time",
      "part_time",
      "contract",
      "internship",
      "freelance",
    ]),
    work_mode: z.enum(["onsite", "hybrid", "remote"]),
    city: z.string(),
    country: z.string().min(1),
    salary_min: z.string().regex(/^\d*$/, "Isi nominal bulat."),
    salary_max: z.string().regex(/^\d*$/, "Isi nominal bulat."),
  })
  .refine(
    (value) =>
      !value.salary_min ||
      !value.salary_max ||
      BigInt(value.salary_min) <= BigInt(value.salary_max),
    { path: ["salary_max"], message: "Maksimum harus ≥ minimum." },
  );
