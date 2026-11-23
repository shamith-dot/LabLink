import { useState } from "react";
import { ArrowRight, FlaskConical, LoaderCircle, LockKeyhole, Mail, UserRound, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import "./AuthDialog.css";

export default function AuthDialog({ onClose, onMessage }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || password.length < 6) {
      setError("Enter a valid email address and a password with at least 6 characters.");
      return;
    }
    if (mode === "signup" && displayName.trim().length < 2) {
      setError("Enter your name so it can be shown with your requests.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { display_name: displayName.trim() } },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          onMessage("Account created. Check your email to confirm it, then sign in.", "info");
          setMode("signin");
          return;
        }
        onMessage("Account created. Your student profile is ready.");
        onClose();
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (signInError) throw signInError;
      onMessage("Signed in. Loading your campus workspace.", "info");
      onClose();
    } catch (authError) {
      setError(authError.message || "Authentication failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="modal-backdrop auth-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button className="icon-button modal-close" aria-label="Close sign-in dialog" onClick={onClose} disabled={busy}><X size={17} /></button>
      <span className="auth-brand-icon"><FlaskConical size={20} /></span>
      <span className="eyebrow">LABLINK CAMPUS ACCESS</span>
      <h2 id="auth-title">{mode === "signin" ? "Sign in to your workspace" : "Create a student account"}</h2>
      <p className="auth-description">{mode === "signin" ? "Use your campus email to request equipment and access your projects." : "New accounts start with student access. Faculty roles are assigned by a campus administrator."}</p>
      <form className="auth-form" onSubmit={submit}>
        {mode === "signup" && <label className="form-field">Full name<span className="auth-input"><UserRound size={15} /><input autoComplete="name" required value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" /></span></label>}
        <label className="form-field">Campus email<span className="auth-input"><Mail size={15} /><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@university.edu" /></span></label>
        <label className="form-field">Password<span className="auth-input"><LockKeyhole size={15} /><input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" /></span></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : null}{busy ? "Please wait" : mode === "signin" ? "Sign in" : "Create account"}{!busy && <ArrowRight size={15} />}</button>
      </form>
      <div className="auth-switch">{mode === "signin" ? "New to LabLink?" : "Already have an account?"}<button onClick={() => { setError(""); setMode(mode === "signin" ? "signup" : "signin"); }}>{mode === "signin" ? "Create account" : "Sign in"}</button></div>
      <p className="auth-security">Access is protected by Supabase authentication and database row-level security.</p>
    </section>
  </div>;
}
