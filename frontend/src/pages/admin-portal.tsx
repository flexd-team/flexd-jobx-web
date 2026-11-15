import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Link2, Plus, ShieldCheck, Users } from "lucide-react";
import { useAppSelector } from "@/hooks/use-app-selector";
import { usePortalResource } from "@/hooks/use-portal-resource";
import { apiRequest } from "@/lib/api-client";
import {
  EmptyState,
  PageHeading,
  ResourceState,
  SearchField,
  StatusBadge,
} from "@/components/portal-ui";
import { emptyEnvelope, envelope, pagination } from "@/schemas/portal";

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  account_type: z.string(),
  account_status: z.string(),
});
const skillSchema = z.object({
  id: z.string(),
  canonical_name: z.string(),
  slug: z.string(),
});
const aliasSchema = z.object({
  id: z.string(),
  skill_id: z.string(),
  alias_name: z.string(),
});
const listSchema = envelope(
  z.object({
    users: z.array(userSchema).optional(),
    skills: z.array(skillSchema).optional(),
    skill_aliases: z.array(aliasSchema).optional(),
    pagination,
  }),
);
const writeSchema = envelope(
  z.object({
    user: userSchema.optional(),
    skill: skillSchema.optional(),
    skill_alias: aliasSchema.optional(),
  }),
);
const inputSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi."),
  value: z.string().trim().min(1, "Nilai wajib diisi."),
});

export function AdminPage({ section }: { section: string }) {
  const token = useAppSelector((s) => s.auth.token);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const path =
    section === "skills"
      ? "/skills"
      : section === "aliases"
        ? "/skill-aliases"
        : "/users";
  const resource = usePortalResource(
    `${path}?limit=20&offset=${offset}`,
    listSchema,
  );
  const form = useForm<z.infer<typeof inputSchema>>({
    resolver: zodResolver(inputSchema),
    defaultValues: { name: "", value: "" },
  });
  const title =
    section === "users"
      ? "User Management"
      : section === "skills"
        ? "Skill Management"
        : "Skill Aliases";
  if (section === "overview")
    return (
      <>
        <PageHeading
          title="Admin Overview"
          description="Kelola operasional dan taksonomi skill. Keputusan rekrutmen tetap milik kandidat dan employer."
        />
        <div className="jx-notice lavender">
          <ShieldCheck size={18} />
          <p>
            Akses admin diperiksa server. Perubahan akun dan penghapusan data
            dapat memengaruhi akses serta relasi terkait.
          </p>
        </div>
        <div className="jx-grid">
          {[
            {
              path: "users",
              title: "User Management",
              text: "Tinjau role dan status akun.",
              icon: Users,
            },
            {
              path: "skills",
              title: "Skill Management",
              text: "Jaga konsistensi canonical skills.",
              icon: ShieldCheck,
            },
            {
              path: "aliases",
              title: "Skill Aliases",
              text: "Petakan variasi penamaan ke skill canonical.",
              icon: Link2,
            },
          ].map((item) => (
            <Link
              className="jx-record"
              key={item.path}
              to={`/admin/${item.path}`}
            >
              <span className="jx-record-icon">
                <item.icon size={21} />
              </span>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
              <span className="jx-actions">
                Kelola
                <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </>
    );
  const rows =
    section === "users"
      ? (resource.data?.data.users ?? [])
      : section === "skills"
        ? (resource.data?.data.skills ?? [])
        : (resource.data?.data.skill_aliases ?? []);
  async function mutate(id: string, body?: object) {
    if (
      !body &&
      !window.confirm(
        "Hapus record ini beserta data yang mengikuti aturan cascade database? Tindakan tidak dapat dibatalkan.",
      )
    )
      return;
    setBusy(id);
    setError("");
    try {
      await apiRequest(`${path}/${id}`, body ? writeSchema : emptyEnvelope, {
        method: body ? "PATCH" : "DELETE",
        token: token!,
        body,
      });
      resource.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Perubahan gagal.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <PageHeading
        title={title}
        description="Data master nyata dari server. Perubahan mengikuti validasi dan batas akses backend."
      >
        {section !== "users" && (
          <button
            className="jx-button primary"
            onClick={() => setAdding(!adding)}
          >
            <Plus size={14} />
            Tambah
          </button>
        )}
      </PageHeading>
      {adding && (
        <form
          className="jx-form"
          onSubmit={form.handleSubmit(async (values) => {
            setError("");
            try {
              await apiRequest(path, writeSchema, {
                method: "POST",
                token: token!,
                body:
                  section === "skills"
                    ? { canonical_name: values.name, slug: values.value }
                    : { alias_name: values.name, skill_id: values.value },
              });
              form.reset();
              setAdding(false);
              resource.reload();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Record gagal dibuat.",
              );
            }
          })}
        >
          <div className="jx-form-grid">
            <label className="jx-field">
              {section === "skills" ? "Canonical name" : "Alias"}
              <input className="jx-input" {...form.register("name")} />
              <span role="alert">{form.formState.errors.name?.message}</span>
            </label>
            <label className="jx-field">
              {section === "skills" ? "Slug" : "Canonical skill ID"}
              <input className="jx-input" {...form.register("value")} />
              <span role="alert">{form.formState.errors.value?.message}</span>
            </label>
          </div>
          <div className="jx-actions">
            <button
              className="jx-button primary"
              disabled={form.formState.isSubmitting}
            >
              Simpan
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
          placeholder="Cari di halaman ini…"
        />
      </div>
      <ResourceState {...resource} retry={resource.reload} />
      {error && (
        <div className="jx-notice error" role="alert">
          {error}
        </div>
      )}
      {resource.data && !rows.length && (
        <EmptyState title="Belum ada record." />
      )}
      <div className="jx-table-wrap">
        <table className="jx-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>
                {section === "users"
                  ? "Role / email"
                  : section === "skills"
                    ? "Slug"
                    : "Skill ID"}
              </th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((row) =>
                ("name" in row
                  ? row.name
                  : "canonical_name" in row
                    ? row.canonical_name
                    : row.alias_name
                )
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((row) => (
                <tr key={row.id}>
                  <td>
                    {"name" in row
                      ? row.name
                      : "canonical_name" in row
                        ? row.canonical_name
                        : row.alias_name}
                  </td>
                  <td>
                    {"email" in row ? (
                      <>
                        {row.account_type} · {row.email}{" "}
                        <StatusBadge value={row.account_status} />
                      </>
                    ) : "slug" in row ? (
                      row.slug
                    ) : (
                      row.skill_id
                    )}
                  </td>
                  <td>
                    <div className="jx-actions">
                      {"account_status" in row && (
                        <button
                          className="jx-button"
                          disabled={busy === row.id}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Ubah status akun ${row.name}? Akses akun dapat berubah.`,
                              )
                            )
                              void mutate(row.id, {
                                account_status:
                                  row.account_status === "active"
                                    ? "inactive"
                                    : "active",
                              });
                          }}
                        >
                          {row.account_status === "active"
                            ? "Nonaktifkan"
                            : "Aktifkan"}
                        </button>
                      )}
                      <button
                        className="jx-button danger"
                        disabled={busy === row.id}
                        onClick={() => void mutate(row.id)}
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
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
          <span>{resource.data.data.pagination.total} record</span>
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
