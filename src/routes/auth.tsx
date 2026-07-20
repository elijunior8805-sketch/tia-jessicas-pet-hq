import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import logoAsset from "@/assets/spa-de-pet-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

// ---------- Rate limit helpers ----------

type AuthErrorLike = { message?: string; status?: number; code?: string; name?: string };

function parseRetryAfter(err: AuthErrorLike): number | null {
  const msg = err?.message ?? "";
  const status = err?.status;
  const code = err?.code ?? "";
  const looks429 =
    status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    /rate limit|too many requests|after \d+ seconds/i.test(msg);
  if (!looks429) return null;
  const m = msg.match(/(\d+)\s*seconds?/i);
  if (m) return Math.max(1, parseInt(m[1], 10));
  return 30; // fallback padrão
}

function friendlyAuthError(err: AuthErrorLike): string {
  const msg = err?.message ?? "Ocorreu um erro. Tente novamente.";
  const code = err?.code ?? "";
  if (code === "invalid_credentials" || /invalid login credentials/i.test(msg))
    return "E-mail ou senha incorretos.";
  if (code === "email_not_confirmed" || /email not confirmed/i.test(msg))
    return "Confirme seu e-mail antes de entrar.";
  if (/user already registered|already exists/i.test(msg))
    return "Este e-mail já está cadastrado. Faça login ou use “Esqueci minha senha”.";
  if (code === "weak_password" || /password/i.test(msg) && /weak|short|characters/i.test(msg))
    return "Senha muito fraca. Use pelo menos 6 caracteres.";
  return msg;
}

// Retry com backoff exponencial; NÃO tenta de novo em 429 (usa cooldown UI).
async function withRetry<T extends { error: AuthErrorLike | null }>(
  fn: () => Promise<T>,
  { retries = 2, baseMs = 400 }: { retries?: number; baseMs?: number } = {},
): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fn();
    if (!res.error) return res;
    if (parseRetryAfter(res.error) !== null) return res; // 429 → repassa
    if (attempt >= retries) return res;
    const jitter = Math.random() * 150;
    await new Promise((r) => setTimeout(r, baseMs * 2 ** attempt + jitter));
    attempt++;
  }
}


// ---------- Component ----------

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");

  // Cooldown separado por ação
  const [signupCooldown, setSignupCooldown] = useState(0);
  const [resetCooldown, setResetCooldown] = useState(0);
  const timers = useRef<{ signup?: number; reset?: number }>({});

  useEffect(() => {
    return () => {
      if (timers.current.signup) window.clearInterval(timers.current.signup);
      if (timers.current.reset) window.clearInterval(timers.current.reset);
    };
  }, []);

  function startCooldown(kind: "signup" | "reset", seconds: number) {
    const setter = kind === "signup" ? setSignupCooldown : setResetCooldown;
    setter(seconds);
    if (timers.current[kind]) window.clearInterval(timers.current[kind]);
    timers.current[kind] = window.setInterval(() => {
      setter((v) => {
        if (v <= 1) {
          window.clearInterval(timers.current[kind]);
          timers.current[kind] = undefined;
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  }

  function handleAuthError(kind: "signup" | "reset" | "login", err: AuthErrorLike) {
    const retry = parseRetryAfter(err);
    if (retry !== null && kind !== "login") {
      startCooldown(kind, retry);
      toast.warning(
        `Muitas tentativas. Aguarde ${retry}s antes de ${
          kind === "signup" ? "cadastrar" : "reenviar o link"
        } novamente.`,
      );
      return;
    }
    toast.error(friendlyAuthError(err));
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await withRetry(() => supabase.auth.signInWithPassword({ email, password }));
    setLoading(false);
    if (error) return handleAuthError("login", error);
    toast.success("Bem-vinda de volta!");
    navigate({ to: "/dashboard" });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (signupCooldown > 0) return;
    setLoading(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await withRetry(() =>
      supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectUrl, data: { nome } },
      }),
    );
    setLoading(false);
    if (error) return handleAuthError("signup", error);
    toast.success("Conta criada. Você já pode entrar.");
  }

  async function handleReset() {
    if (resetCooldown > 0) return;
    if (!email) return toast.error("Informe seu e-mail acima primeiro");
    const { error } = await withRetry(() =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      }),
    );
    if (error) return handleAuthError("reset", error);
    toast.success("Enviamos um link de recuperação para seu e-mail.");
    startCooldown("reset", 60); // cooldown preventivo
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-8 bg-gradient-to-br from-background via-secondary/30 to-accent/40">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-24 w-24 items-center justify-center rounded-2xl bg-white shadow-elegant ring-1 ring-border mb-4 overflow-hidden">
            <img src={logoAsset.url} alt="Spa de Pet Tia Jéssica" className="h-20 w-20 object-contain" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-primary">Spa de Pet Tia Jéssica</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão premium para banho e tosa</p>
        </div>

        <div className="card-premium p-6 sm:p-8">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="l-email">E-mail</Label>
                  <Input id="l-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="l-pass">Senha</Label>
                  <Input id="l-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando…" : "Entrar"}
                </Button>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={resetCooldown > 0}
                  className="w-full text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resetCooldown > 0
                    ? `Aguarde ${resetCooldown}s para reenviar`
                    : "Esqueci minha senha"}
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="s-nome">Seu nome</Label>
                  <Input id="s-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-email">E-mail</Label>
                  <Input id="s-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-pass">Senha</Label>
                  <Input id="s-pass" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                  <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
                </div>
                <Button type="submit" className="w-full" disabled={loading || signupCooldown > 0}>
                  {loading
                    ? "Criando…"
                    : signupCooldown > 0
                    ? `Aguarde ${signupCooldown}s`
                    : "Criar conta"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  A primeira conta criada torna-se administradora automaticamente.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
