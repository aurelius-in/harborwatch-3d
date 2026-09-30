import { useState } from "react";
import { ops } from "../lib/store";

const DEMOS = [
  { label: "Viewer", email: "viewer@harborwatch.local", password: "viewer", hint: "Read-only board" },
  { label: "Operator", email: "operator@harborwatch.local", password: "operator", hint: "Ack and history" },
  { label: "Admin", email: "admin@harborwatch.local", password: "admin", hint: "Users, sites, audit" },
];

export function LoginPage() {
  const [email, setEmail] = useState("operator@harborwatch.local");
  const [password, setPassword] = useState("operator");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(nextEmail = email, nextPassword = password) {
    setBusy(true);
    setError(null);
    try {
      await ops.login(nextEmail, nextPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-layout">
        <section className="login-brand" aria-label="HarborWatch 3D">
          <img src="/hw3d-logo-loop.gif" alt="HarborWatch 3D" className="login-logo" />
          <h1>HarborWatch 3D</h1>
          <p className="login-kicker">Real-time sensor fusion operations console</p>
          <ul className="login-sites">
            <li>
              <span>Alder Harbor</span>
              <em>Primary basin</em>
            </li>
            <li>
              <span>Cedar Inlet</span>
              <em>Second site</em>
            </li>
          </ul>
          <p className="login-note">Local identity adapter. Hosted environments should use OIDC, which is not wired in this demo.</p>
        </section>
        <section className="login-card">
          <h2>Sign in</h2>
          <p className="login-kicker">Role-aware console for Viewer, Operator, and Admin.</p>
          <form
            className="login-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label>
              Email
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                inputMode="email"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            {error ? (
              <p className="error-text" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <div className="demo-row">
            {DEMOS.map((demo) => (
              <button
                key={demo.label}
                type="button"
                className="btn-ghost"
                title={demo.hint}
                onClick={() => {
                  setEmail(demo.email);
                  setPassword(demo.password);
                  void submit(demo.email, demo.password);
                }}
              >
                {demo.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
