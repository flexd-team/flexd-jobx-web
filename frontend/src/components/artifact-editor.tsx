import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api-client";
import { visibilityLabels } from "@/lib/portal-labels";
import { artifact, envelope } from "@/schemas/portal";
import { useAppSelector } from "@/hooks/use-app-selector";

const schema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10000),
    visibility: z.enum(["private", "unlisted", "matching_employers", "public"]),
    role_title: z.string().max(150),
    contribution_description: z.string().max(10000),
  })
  .refine(
    (value) =>
      Boolean(value.role_title.trim()) ===
      Boolean(value.contribution_description.trim()),
    {
      path: ["contribution_description"],
      message: "Isi peran dan kontribusi bersama-sama.",
    },
  );
const saved = envelope(z.object({ artifact }));
const contributionSaved = envelope(
  z.object({ artifact_contribution: z.object({ id: z.string() }) }),
);

export function ArtifactEditor({
  item,
  reload,
}: {
  item: z.infer<typeof artifact>;
  reload: () => void;
}) {
  const token = useAppSelector((s) => s.auth.token);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: item.title,
      description: item.description || "",
      visibility: item.visibility as z.infer<typeof schema>["visibility"],
      role_title: "",
      contribution_description: "",
    },
  });
  return (
    <details className="jx-detail">
      <summary>Edit karya & kontribusi</summary>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          setError("");
          setNotice("");
          try {
            await apiRequest(`/my/artifacts/${item.id}`, saved, {
              method: "PATCH",
              token: token!,
              body: {
                title: values.title,
                description: values.description,
                visibility: values.visibility,
              },
            });
            if (values.role_title.trim()) {
              try {
                await apiRequest(
                  `/my/artifacts/${item.id}/contribution`,
                  contributionSaved,
                  {
                    method: "POST",
                    token: token!,
                    body: {
                      role_title: values.role_title,
                      contribution_description: values.contribution_description,
                    },
                  },
                );
              } catch (err) {
                setError(
                  `Metadata tersimpan, kontribusi belum tersimpan: ${err instanceof Error ? err.message : "Coba lagi."}`,
                );
                reload();
                return;
              }
            }
            setNotice("Perubahan tersimpan.");
            reload();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Perubahan gagal.");
          }
        })}
      >
        <div className="jx-form-grid" style={{ marginTop: 16 }}>
          <label className="jx-field full">
            Judul
            <input className="jx-input" {...form.register("title")} />
          </label>
          <label className="jx-field full">
            Deskripsi
            <textarea className="jx-input" {...form.register("description")} />
          </label>
          <label className="jx-field full">
            Visibilitas
            <select className="jx-input" {...form.register("visibility")}>
              {["private", "unlisted", "matching_employers", "public"].map(
                (value) => (
                  <option key={value} value={value}>{visibilityLabels[value]}</option>
                ),
              )}
            </select>
          </label>
          <label className="jx-field full">
            Peran Anda
            <input
              className="jx-input"
              placeholder="Opsional, contoh: Backend Developer"
              {...form.register("role_title")}
            />
          </label>
          <label className="jx-field full">
            Kontribusi pribadi
            <textarea
              className="jx-input"
              placeholder="Isi untuk menyimpan atau mengganti klaim self-declared Anda."
              {...form.register("contribution_description")}
            />
            <small>
              Klaim mandiri bukan verifikasi organisasi. Klaim yang sudah
              dikonfirmasi dilindungi.
            </small>
          </label>
        </div>
        {Object.values(form.formState.errors).map((error, index) => (
          <p role="alert" key={index}>
            {error.message}
          </p>
        ))}
        <div className="jx-actions">
          <button
            className="jx-button primary"
            disabled={form.formState.isSubmitting}
          >
            Simpan perubahan
          </button>
        </div>
        {error && (
          <div className="jx-notice error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="jx-notice success" role="status">
            {notice}
          </div>
        )}
      </form>
    </details>
  );
}
