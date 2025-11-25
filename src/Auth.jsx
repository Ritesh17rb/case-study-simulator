import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import ensureSupabaseSession from "supabase-oauth-popup";
import { bootstrapAlert } from "bootstrap-alert";
import saveform from "saveform";

export default function Auth() {
  useEffect(() => { try { saveform("#auth-form"); } catch {} }, []);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) bootstrapAlert({ title: "Login", body: error.message, color: "danger" });
    else bootstrapAlert({ title: "Login", body: "Check your email for the login link!", color: "info" });
    setLoading(false);
  };

  const handleOAuth = async (provider) => {
    try {
      setLoading(true);
      await ensureSupabaseSession(supabase, { provider });
      bootstrapAlert({ title: "Login", body: "Signed in!", color: "success", replace: true });
    } catch (err) {
      bootstrapAlert({ title: "Login failed", body: String(err?.message || err), color: "danger" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container d-flex align-items-center justify-content-center min-vh-100">
      <div className="card shadow-sm" style={{ maxWidth: 420, width: "100%" }}>
        <div className="card-body">
          <h1 className="h4 mb-2 text-center">Case Study Login</h1>
          <p className="text-muted text-center mb-4">Sign in to save your progress</p>

          <div className="d-grid gap-2 mb-3">
            <button onClick={() => handleOAuth("google")} disabled={loading} className="btn btn-danger">
              <i className="bi bi-google me-2"></i> Continue with Google
            </button>
            <button onClick={() => handleOAuth("github")} disabled={loading} className="btn btn-dark">
              <i className="bi bi-github me-2"></i> Continue with GitHub
            </button>
          </div>

          <div className="text-center text-muted small my-2">or</div>

          <form id="auth-form" onSubmit={handleMagicLink} className="d-grid gap-2">
            <input
              className="form-control"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <button className="btn btn-primary" disabled={loading}>
              {loading ? "Sending link..." : "Send Magic Link"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

