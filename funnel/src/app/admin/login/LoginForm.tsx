"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: "" });
  return (
    <form action={action} className="login-card">
      <h1>CDA lead workspace</h1>
      <p className="muted">Private. For Cost2shoot and CDA Heating &amp; Cooling staff.</p>
      <label className="afield">
        <span>Password</span>
        <input type="password" name="password" autoComplete="current-password" required autoFocus />
      </label>
      {state.error && <p className="banner banner-stop" role="alert">{state.error}</p>}
      <button className="abtn abtn-primary" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
