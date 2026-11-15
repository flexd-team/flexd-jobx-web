import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";
import authReducer, { setSession } from "@/redux/slices/auth-slice";
import { AppShell } from "@/components/layout/app-shell";
import { ArtifactsPage, EvidencePage } from "@/pages/portal";
import { CreateJobPage } from "@/pages/employer-portal";
import App from "@/App";

function mount(
  ui: React.ReactNode,
  role = "candidate",
  route = "/candidate/artifacts",
) {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(
    setSession({
      token: "test-only-token",
      accountType: role,
      user: {
        id: "2",
        name: "Test Candidate",
        email: "test@example.com",
        account_type: role,
      },
    }),
  );
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </Provider>,
  );
}
const response = (data: object, status = 200) =>
  new Response(
    JSON.stringify({
      message:
        status === 200
          ? { success: "OK" }
          : { error: "Server tidak tersedia." },
      error: {},
      data,
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("Prototype production integration", () => {
  it("uses role navigation without prototype role switch controls", () => {
    mount(
      <AppShell>
        <p>Konten</p>
      </AppShell>,
    );
    expect(
      screen.getByRole("link", { name: "Smart Artifacts" }),
    ).toHaveAttribute("href", "/candidate/artifacts");
    expect(screen.queryByText("Prototype controls")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Create Job" }),
    ).not.toBeInTheDocument();
  });

  it("shows API failure, never synthetic artifacts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({}, 503)));
    mount(<ArtifactsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Server tidak tersedia.",
    );
    expect(
      screen.queryByText("Hospital Management Microservice"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Coba lagi" }),
    ).toBeInTheDocument();
  });

  it("uses evidence response keys and persists review through API", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, options?: RequestInit) =>
        Promise.resolve(
          options?.method === "PATCH"
            ? response({
                artifact_skill_evidence: {
                  id: "8",
                  review_status: "candidate_confirmed",
                },
              })
            : response({
                artifact_skill_evidences: [
                  {
                    id: "8",
                    artifact_id: "1",
                    skill_id: "2",
                    skill_name: "Python",
                    evidence_kind: "direct",
                    evidence_excerpt: "print(1)",
                    evidence_location: "main.py:1",
                    confidence_score: "0.9000",
                    review_status: "ai_suggested",
                  },
                ],
              }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    mount(<EvidencePage />);
    expect(
      await screen.findByRole("heading", { name: "Python" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Konfirmasi" }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          (call) =>
            call[1]?.method === "PATCH" &&
            call[1]?.body ===
              JSON.stringify({ review_status: "candidate_confirmed" }),
        ),
      ).toBe(true),
    );
  });

  it("does not silently generate synthetic JD on model failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(
            url.includes("catalog")
              ? response({ skills: [] })
              : response({}, 503),
          ),
        ),
    );
    mount(<CreateJobPage />, "employer", "/employer/create-job");
    await userEvent.type(
      screen.getByRole("textbox", { name: /^Business problem/ }),
      "Bangun sistem inventaris.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Generate draft" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Draft AI belum tersedia. Coba lagi, atau lanjutkan dengan Tulis manual.",
    );
    expect(
      screen.queryByText("Backend Engineer - Sistem Inventaris"),
    ).not.toBeInTheDocument();
  });

  it("redirects candidate away from admin routes", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response({
            artifacts: [],
            artifact_skill_evidences: [],
            pagination: { total: 0, limit: 1, offset: 0 },
          }),
        ),
    );
    mount(<App />, "candidate", "/admin/users");
    expect(
      await screen.findByRole("heading", { name: /Selamat datang/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "User Management" }),
    ).not.toBeInTheDocument();
  });
});
