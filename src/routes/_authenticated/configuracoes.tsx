import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { User, Lock, Eye, EyeOff, MessageCircle, History } from "lucide-react";
import { z } from "zod";
import { useMyProfile } from "@/hooks/use-my-profile";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: profile, isLoading } = useMyProfile();

  useEffect(() => {
    if (profile) {
      setNome(profile.nome ?? "");
      setTelefone(profile.telefone ?? "");
      setEmail(profile.email ?? profile.authEmail ?? "");
    }
  }, [profile]);


  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe seu nome");
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ nome: nome.trim(), telefone: telefone.trim() || null })
      .eq("id", u.user.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar", { description: error.message });
      return;
    }
    toast.success("Perfil atualizado");
    qc.invalidateQueries({ queryKey: ["me-profile"] });
  }

  return (
    <PageShell>
      <PageHeader title="Configurações" description="Dados da empresa, usuários e preferências." />

      <Card className="p-6 rounded-2xl border-border/60 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-primary">Meu perfil</h2>
            <p className="text-sm text-muted-foreground">Seu nome aparece na saudação do painel.</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="nome">Nome de exibição</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Jéssica"
              disabled={isLoading}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(11) 90000-0000"
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" value={email} disabled />
            <p className="text-xs text-muted-foreground">O e-mail de acesso não pode ser alterado por aqui.</p>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving || isLoading}>
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </Card>

      <WhatsAppTemplatesCard />
      <RecibosEnviadosCard />
      <ChangePasswordCard authEmail={profile?.authEmail ?? ""} />
    </PageShell>
  );
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Informe a senha atual"),
    next: z
      .string()
      .min(8, "A nova senha deve ter no mínimo 8 caracteres")
      .max(72, "A senha deve ter no máximo 72 caracteres"),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, {
    path: ["confirm"],
    message: "As senhas não conferem",
  })
  .refine((v) => v.current !== v.next, {
    path: ["next"],
    message: "A nova senha deve ser diferente da atual",
  });

function ChangePasswordCard({ authEmail }: { authEmail: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = passwordSchema.safeParse({ current, next, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    if (!authEmail) {
      toast.error("Sessão inválida. Faça login novamente.");
      return;
    }

    setLoading(true);
    // Reautentica com a senha atual antes de trocar
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: current,
    });
    if (reauthErr) {
      setLoading(false);
      toast.error("Senha atual incorreta");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: next });
    setLoading(false);

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("weak") || msg.includes("pwned") || msg.includes("compromised")) {
        toast.error("Essa senha aparece em vazamentos conhecidos. Escolha outra.");
      } else if (msg.includes("should be different")) {
        toast.error("A nova senha deve ser diferente da atual.");
      } else {
        toast.error("Não foi possível trocar a senha", { description: error.message });
      }
      return;
    }

    toast.success("Senha atualizada com sucesso");
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  return (
    <Card className="p-6 rounded-2xl border-border/60 max-w-2xl mt-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
          <Lock className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold text-primary">Trocar senha</h2>
          <p className="text-sm text-muted-foreground">
            Confirme sua senha atual e escolha uma nova de no mínimo 8 caracteres.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        <div className="grid gap-2">
          <Label htmlFor="current">Senha atual</Label>
          <div className="relative">
            <Input
              id="current"
              type={showCurrent ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowCurrent((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showCurrent ? "Ocultar senha" : "Mostrar senha"}
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="next">Nova senha</Label>
          <div className="relative">
            <Input
              id="next"
              type={showNext ? "text" : "password"}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
            />
            <button
              type="button"
              onClick={() => setShowNext((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showNext ? "Ocultar senha" : "Mostrar senha"}
            >
              {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Mínimo 8 caracteres. Senhas em vazamentos conhecidos são bloqueadas.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="confirm">Confirmar nova senha</Label>
          <Input
            id="confirm"
            type={showNext ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando…" : "Atualizar senha"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

