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
import { User, Lock, Eye, EyeOff, MessageCircle, History, Building2 } from "lucide-react";
import { z } from "zod";
import { useMyProfile } from "@/hooks/use-my-profile";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FotoPicker } from "@/components/foto-picker";
import { uploadFoto, removeFoto } from "@/lib/foto-upload";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);

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
    const patch: any = { nome: nome.trim(), telefone: telefone.trim() || null };
    if (avatarFile) {
      try {
        const path = await uploadFoto("avatars", u.user.id, avatarFile);
        patch.avatar_url = path;
        if (profile?.avatar_url && profile.avatar_url !== path) {
          removeFoto(profile.avatar_url).catch(() => {});
        }
      } catch (e: any) {
        setSaving(false);
        toast.error("Falha ao enviar foto", { description: e?.message });
        return;
      }
    } else if (avatarRemoved && profile?.avatar_url) {
      patch.avatar_url = null;
      removeFoto(profile.avatar_url).catch(() => {});
    }
    const { error } = await supabase.from("profiles").update(patch).eq("id", u.user.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar", { description: error.message });
      return;
    }
    setAvatarFile(null);
    setAvatarRemoved(false);
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
          <div className="flex justify-center pb-2">
            <FotoPicker
              currentPath={profile?.avatar_url ?? null}
              onFileChange={setAvatarFile}
              onRemoveExisting={() => setAvatarRemoved(true)}
              placeholderIcon={User}
              size="md"
              label="Sua foto"
            />
          </div>

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

      <EmpresaCard />
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

const DEFAULT_TEMPLATES = {
  receber:
    'Olá, {contraparte}! 🐾\n\nSegue o recibo de pagamento nº {numero} no valor de *{valor}* referente a "{descricao}".\n\nObrigada pela confiança! ✨\n{assinatura}',
  pagar:
    'Olá, {contraparte}!\n\nSegue o comprovante nº {numero} referente a "{descricao}" no valor de *{valor}*, pago em {data}.\n\nObrigada!\n{assinatura}',
};

const VAR_HINTS = [
  { k: "{contraparte}", d: "Nome do cliente/fornecedor" },
  { k: "{valor}", d: "Valor formatado em reais" },
  { k: "{numero}", d: "Nº do recibo/comprovante" },
  { k: "{descricao}", d: "Descrição do documento" },
  { k: "{data}", d: "Data de hoje" },
  { k: "{forma}", d: "Forma de pagamento" },
  { k: "{assinatura}", d: "Assinatura configurada abaixo" },
];

function WhatsAppTemplatesCard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["empresa-config-whatsapp"],
    queryFn: async () => {
      const { data } = await supabase
        .from("empresa_config")
        .select("id, whatsapp_template_receber, whatsapp_template_pagar, whatsapp_assinatura")
        .maybeSingle();
      return data;
    },
  });

  const [receber, setReceber] = useState("");
  const [pagar, setPagar] = useState("");
  const [assinatura, setAssinatura] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setReceber(data.whatsapp_template_receber ?? DEFAULT_TEMPLATES.receber);
      setPagar(data.whatsapp_template_pagar ?? DEFAULT_TEMPLATES.pagar);
      setAssinatura(data.whatsapp_assinatura ?? "");
    }
  }, [data]);

  async function salvar() {
    if (!data?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("empresa_config")
      .update({
        whatsapp_template_receber: receber,
        whatsapp_template_pagar: pagar,
        whatsapp_assinatura: assinatura,
      })
      .eq("id", data.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar", { description: error.message });
      return;
    }
    toast.success("Modelos de WhatsApp salvos");
    qc.invalidateQueries({ queryKey: ["empresa-config-whatsapp"] });
  }

  function restaurar(tipo: "receber" | "pagar") {
    if (tipo === "receber") setReceber(DEFAULT_TEMPLATES.receber);
    else setPagar(DEFAULT_TEMPLATES.pagar);
  }

  return (
    <Card className="p-6 rounded-2xl border-border/60 max-w-2xl mt-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold text-primary">Mensagens do WhatsApp</h2>
          <p className="text-sm text-muted-foreground">
            Modelo enviado ao emitir recibo (Receber) ou comprovante (Pagar). Use as variáveis abaixo.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 mb-5">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Variáveis disponíveis
        </div>
        <div className="flex flex-wrap gap-2">
          {VAR_HINTS.map((v) => (
            <Badge key={v.k} variant="outline" className="font-mono text-[11px]" title={v.d}>
              {v.k}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="tpl-receber">Modelo para Receber (recibo)</Label>
            <Button type="button" size="sm" variant="ghost" onClick={() => restaurar("receber")}>
              Restaurar padrão
            </Button>
          </div>
          <Textarea
            id="tpl-receber"
            value={receber}
            onChange={(e) => setReceber(e.target.value)}
            rows={7}
            disabled={isLoading}
            className="font-mono text-xs"
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="tpl-pagar">Modelo para Pagar (comprovante)</Label>
            <Button type="button" size="sm" variant="ghost" onClick={() => restaurar("pagar")}>
              Restaurar padrão
            </Button>
          </div>
          <Textarea
            id="tpl-pagar"
            value={pagar}
            onChange={(e) => setPagar(e.target.value)}
            rows={7}
            disabled={isLoading}
            className="font-mono text-xs"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="assinatura">Assinatura padrão</Label>
          <Textarea
            id="assinatura"
            value={assinatura}
            onChange={(e) => setAssinatura(e.target.value)}
            rows={3}
            disabled={isLoading}
            placeholder="Ex.: Spa de Pet Tia Jéssica · (11) 90000-0000"
          />
          <p className="text-xs text-muted-foreground">
            Substitui a variável <code className="font-mono">{"{assinatura}"}</code> nas mensagens.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={salvar} disabled={saving || isLoading}>
            {saving ? "Salvando…" : "Salvar modelos"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function RecibosEnviadosCard() {
  const { data: envios = [], isLoading } = useQuery({
    queryKey: ["recibos-enviados-recentes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("recibos_enviados")
        .select("id, tipo, numero_recibo, contraparte, valor, enviado_em, signed_url, telefone")
        .order("enviado_em", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  return (
    <Card className="p-6 rounded-2xl border-border/60 max-w-2xl mt-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
          <History className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold text-primary">Auditoria de envios</h2>
          <p className="text-sm text-muted-foreground">
            Últimos 20 recibos enviados por WhatsApp, com data/hora e link para reabrir.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : envios.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum recibo enviado ainda.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {envios.map((e) => (
            <li key={e.id} className="py-3 flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {e.tipo === "receita" ? "Recibo" : "Comprovante"}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">{e.numero_recibo}</span>
                </div>
                <div className="font-medium truncate">{e.contraparte || "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(e.enviado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  {e.telefone ? ` · ${e.telefone}` : ""}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-sm">
                  {Number(e.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                {e.signed_url && (
                  <a
                    href={e.signed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline text-primary"
                  >
                    Abrir PDF
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

