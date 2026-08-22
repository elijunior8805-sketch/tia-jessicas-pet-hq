create table public.ia_auditoria (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now(),
    usuario_id uuid references auth.users(id),
    comando_original text not null,
    transcricao text,
    intencao_identificada text,
    dados_extraidos jsonb,
    ferramentas_chamadas jsonb,
    status text, -- 'sucesso', 'erro', 'cancelado'
    erro text,
    tempo_resposta_ms integer,
    metadados jsonb
);

grant insert, select on public.ia_auditoria to authenticated;
grant all on public.ia_auditoria to service_role;

alter table public.ia_auditoria enable row level security;

create policy "Usuários podem ver sua própria auditoria"
on public.ia_auditoria
for select
to authenticated
using (auth.uid() = usuario_id);

create policy "Usuários podem inserir sua própria auditoria"
on public.ia_auditoria
for insert
to authenticated
with check (auth.uid() = usuario_id);

create policy "Admins podem ver toda a auditoria"
on public.ia_auditoria
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));
