import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Notif = {
  id: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
};

export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUid(u.user.id);
    const { data } = await (supabase as any).from("notificacoes")
      .select("id, titulo, mensagem, link, lida, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems(data ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("notif")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "notificacoes" },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const naoLidas = items.filter((i) => !i.lida).length;

  const marcarTodasLidas = async () => {
    if (!uid) return;
    await (supabase as any).from("notificacoes")
      .update({ lida: true }).eq("user_id", uid).eq("lida", false);
    load();
  };

  const abrir = async (n: Notif) => {
    if (!n.lida) {
      await (supabase as any).from("notificacoes").update({ lida: true }).eq("id", n.id);
    }
    if (n.link) navigate({ to: n.link as any });
    load();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {naoLidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificações</span>
          {naoLidas > 0 && (
            <button className="text-xs text-primary hover:underline" onClick={marcarTodasLidas}>
              Marcar todas como lidas
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Sem notificações no momento.
          </div>
        ) : (
          <div className="max-h-[380px] overflow-y-auto">
            {items.map((n) => (
              <button key={n.id} onClick={() => abrir(n)}
                className={`w-full text-left px-3 py-2 hover:bg-muted transition ${
                  n.lida ? "" : "bg-primary/5"
                }`}>
                <div className="text-sm font-medium">{n.titulo}</div>
                {n.mensagem && (
                  <div className="text-xs text-muted-foreground line-clamp-2">{n.mensagem}</div>
                )}
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                </div>
              </button>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
