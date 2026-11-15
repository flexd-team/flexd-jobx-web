import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAppSelector } from "@/hooks/use-app-selector";
import { apiRequest } from "@/lib/api-client";
import { PageHeading, ResourceState } from "@/components/portal-ui";
import { usePortalResource } from "@/hooks/use-portal-resource";
import { envelope } from "@/schemas/portal";

const profileInput = z.object({
  headline: z.string().max(150),
  biography: z.string().max(5000),
  city: z.string().max(120),
  country: z.string().min(1).max(100),
  years_experience: z.number().int().min(0).max(100),
  preferred_employment_type: z.enum([
    "full_time",
    "part_time",
    "contract",
    "internship",
    "freelance",
    "any",
  ]),
  preferred_work_mode: z.enum(["onsite", "hybrid", "remote", "any"]),
  profile_visibility: z.enum([
    "public",
    "registered_only",
    "matching_employers",
    "private",
  ]),
  name: z.string().max(200),
  industry: z.string().max(120),
  description: z.string().max(5000),
});
const candidateProfile = z.object({
  headline: z.string().nullable(),
  biography: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string(),
  years_experience: z.number().nullable(),
  preferred_employment_type: z.string(),
  preferred_work_mode: z.string(),
  profile_visibility: z.string(),
});
const companyProfile = z.object({
  name: z.string(),
  industry: z.string().nullable(),
  description: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string(),
});
const profileResponse = envelope(
  z.object({
    candidate_profile: candidateProfile.nullable().optional(),
    company_profile: companyProfile.nullable().optional(),
  }),
);

export default function ProfilePage() {
  const { token, accountType } = useAppSelector((s) => s.auth);
  const employer = accountType === "employer";
  const resource = usePortalResource(
    employer ? "/my/company-profile" : "/my/candidate-profile",
    profileResponse,
  );
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const form = useForm<z.infer<typeof profileInput>>({
    resolver: zodResolver(profileInput),
    defaultValues: {
      headline: "",
      biography: "",
      city: "",
      country: "Indonesia",
      years_experience: 0,
      preferred_employment_type: "full_time",
      preferred_work_mode: "remote",
      profile_visibility: "matching_employers",
      name: "",
      industry: "",
      description: "",
    },
  });
  const { reset } = form;
  useEffect(() => {
    const profile =
      resource.data?.data.company_profile ??
      resource.data?.data.candidate_profile;
    if (!profile) return;
    const values = Object.fromEntries(
      Object.entries(profile).map(([key, value]) => [
        key,
        value ?? (key === "years_experience" ? 0 : ""),
      ]),
    );
    reset((previous) => ({ ...previous, ...values }));
  }, [resource.data, reset]);
  return (
    <>
      <PageHeading
        title={employer ? "Company Profile" : "My Profile"}
        description={
          employer
            ? "Beri kandidat konteks tentang perusahaan, tim, dan kebutuhan Anda."
            : "Ceritakan pengalaman dan preferensi Anda. Bukti kompetensi tetap berasal dari karya yang bisa ditinjau."
        }
      />
      <ResourceState {...resource} retry={resource.reload} />
      <form
        className="jx-form"
        onSubmit={form.handleSubmit(async (values) => {
          setError("");
          setNotice("");
          if (employer && !values.name.trim()) {
            form.setError("name", { message: "Nama perusahaan wajib diisi." });
            return;
          }
          const body = employer
            ? {
                name: values.name,
                industry: values.industry,
                description: values.description,
                city: values.city,
                country: values.country,
              }
            : {
                headline: values.headline,
                biography: values.biography,
                city: values.city,
                country: values.country,
                years_experience: values.years_experience,
                preferred_employment_type: values.preferred_employment_type,
                preferred_work_mode: values.preferred_work_mode,
                profile_visibility: values.profile_visibility,
              };
          try {
            await apiRequest(
              employer ? "/my/company-profile" : "/my/candidate-profile",
              profileResponse,
              { method: "POST", token: token!, body },
            );
            setNotice("Profil tersimpan.");
            resource.reload();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Profil gagal disimpan.",
            );
          }
        })}
      >
        <h2>{employer ? "Tentang perusahaan" : "Tentang saya"}</h2>
        <div className="jx-form-grid">
          {(employer
            ? (["name", "industry", "description"] as const)
            : (["headline", "biography"] as const)
          ).map((field) => (
            <label
              className={`jx-field ${field === "biography" || field === "description" ? "full" : ""}`}
              key={field}
            >
              {
                {
                  name: "Nama perusahaan",
                  industry: "Industri",
                  description: "Deskripsi perusahaan",
                  headline: "Headline",
                  biography: "Tentang saya",
                }[field]
              }
              {field === "biography" || field === "description" ? (
                <textarea className="jx-input" {...form.register(field)} />
              ) : (
                <input className="jx-input" {...form.register(field)} />
              )}
              <span role="alert">{form.formState.errors[field]?.message}</span>
            </label>
          ))}
          <label className="jx-field">
            Kota
            <input className="jx-input" {...form.register("city")} />
          </label>
          <label className="jx-field">
            Negara
            <input className="jx-input" {...form.register("country")} />
            <span role="alert">{form.formState.errors.country?.message}</span>
          </label>
          {!employer && (
            <>
              <label className="jx-field">
                Pengalaman (tahun)
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="jx-input"
                  {...form.register("years_experience", {
                    valueAsNumber: true,
                  })}
                />
                <span role="alert">
                  {form.formState.errors.years_experience?.message}
                </span>
              </label>
              <label className="jx-field">
                Preferensi pekerjaan
                <select
                  className="jx-input"
                  {...form.register("preferred_employment_type")}
                >
                  {profileInput.shape.preferred_employment_type.options.map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </label>
              <label className="jx-field">
                Preferensi mode kerja
                <select
                  className="jx-input"
                  {...form.register("preferred_work_mode")}
                >
                  {profileInput.shape.preferred_work_mode.options.map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </label>
              <label className="jx-field">
                Visibilitas profil
                <select
                  className="jx-input"
                  {...form.register("profile_visibility")}
                >
                  {profileInput.shape.profile_visibility.options.map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </label>
            </>
          )}
        </div>
        <div className="jx-actions">
          <button
            className="jx-button primary"
            disabled={
              resource.loading ||
              !!resource.error ||
              form.formState.isSubmitting
            }
          >
            {form.formState.isSubmitting ? "Menyimpan…" : "Simpan perubahan"}
          </button>
        </div>
        {notice && (
          <div className="jx-notice success" role="status">
            {notice}
          </div>
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
