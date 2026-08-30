import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

interface LoginProps {
  onLogin(token: string, user: unknown): void;
}

export function Login({ onLogin }: LoginProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.message || "Não foi possível entrar.");
      onLogin(body.token, body.user);
      navigate("/dashboard", { replace: true });
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Erro ao autenticar.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">SIGMA</div>
        <p>Sistema Integrado de Gerenciamento e Monitoramento de AGVs</p>
        <label>
          E-mail
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
            autoFocus
          />
        </label>
        <label>
          Senha
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            minLength={8}
            required
          />
        </label>
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button"
          type="submit"
          disabled={loading || !email || !password}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
