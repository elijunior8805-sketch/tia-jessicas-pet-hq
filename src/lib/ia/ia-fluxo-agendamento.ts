/**
 * Fluxo conversacional de agendamento (voz e texto usam exatamente o mesmo caminho):
 * entrada → interpretação → busca → dados faltantes → confirmação → salvamento → verificação.
 * Nada é preenchido automaticamente sem o usuário confirmar.
 */

import { buscarClientesIA, buscarPetsDoClienteIA, buscarServicosIA } from "./ia-consultas.functions";
import { interpretarData, interpretarHora, detectarServico, preInterpretar, interpretarEscolha, limpar, hojeSP } from "./ia-nlp";
import { mascararTelefone } from "./ia-nomes";

export type EtapaAgendamento =
  | "cliente"
  | "confirmar_cliente"
  | "escolher_cliente"
  | "cliente_inexistente"
  | "pet"
  | "servico"
  | "data"
  | "hora"
  | "transporte"
  | "resumo";

export interface ClienteFluxo {
  id: string;
  nome: string;
  telefone?: string | null;
  bairro?: string | null;
  pets?: { id: string; nome: string }[];
}

export interface AgendaDraft {
  etapa: EtapaAgendamento;
  comando_original: string;
  termo_cliente?: string | null;
  cliente?: ClienteFluxo | null;
  candidatos?: ClienteFluxo[];
  pets_candidatos?: { id: string; nome: string }[];
  pet?: { id: string; nome: string } | null;
  servico?: { id: string; nome: string; valor: number; duracao_min: number } | null;
  servicos_candidatos?: { id: string; nome: string; valor: number; duracao_min: number }[];
  termo_servico?: string | null;
  data?: string | null;
  hora?: string | null;
  transporte?: boolean | null;
  taxa_transporte?: number;
}

export interface PassoFluxo {
  draft: AgendaDraft | null;
  mensagem: string;
  pronto: boolean;
  parametros?: Record<string, any>;
}

const SIM = /^(s|sim|isso|isso mesmo|e ele|e ela|e esse|e esta|confirmo|confirma|correto|exato|pode ser|ok|positivo|claro|com certeza|afirmativo)\b/;
const NAO = /^(n|nao|negativo|errado|outro|outra|nenhum|nenhuma)\b/;

function ehSim(texto: string) {
  return SIM.test(limpar(texto));
}
function ehNao(texto: string) {
  return NAO.test(limpar(texto));
}

function formatarData(iso?: string | null) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function somarMinutos(hora: string, minutos: number) {
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + (minutos || 60);
  const hh = Math.floor((total % 1440) / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function iniciarDraft(texto: string): AgendaDraft {
  const pre = preInterpretar(texto);
  return {
    etapa: "cliente",
    comando_original: texto,
    termo_cliente: pre.cliente_nome,
    termo_servico: pre.servico_nome,
    data: pre.data,
    hora: pre.hora,
    transporte: pre.transporte,
    taxa_transporte: 0,
  };
}

async function buscarCliente(draft: AgendaDraft, termo: string): Promise<PassoFluxo> {
  const res: any = await buscarClientesIA({ data: { termo, comando_original: draft.comando_original } });
  const lista: ClienteFluxo[] = (res?.data || []).map((c: any) => ({
    id: c.id,
    nome: c.nome,
    telefone: c.telefone || c.whatsapp,
    bairro: c.bairro,
    pets: (c.pets || []).map((p: any) => ({ id: p.id, nome: p.nome })),
  }));

  if (lista.length === 0) {
    return {
      draft: { ...draft, etapa: "cliente_inexistente", termo_cliente: termo },
      mensagem: `Não localizei nenhum cliente com "${termo}" na base.\n\n**Cliente não cadastrado. Deseja cadastrar agora?**`,
      pronto: false,
    };
  }

  if (lista.length === 1) {
    const c = lista[0];
    return {
      draft: { ...draft, etapa: "confirmar_cliente", candidatos: lista, termo_cliente: termo },
      mensagem:
        `Encontrei **${c.nome}**\n` +
        `- Telefone: ${mascararTelefone(c.telefone)}\n` +
        `- Bairro: ${c.bairro || "não informado"}\n` +
        `- Pets: ${c.pets?.map((p) => p.nome).join(", ") || "nenhum pet cadastrado"}\n\n` +
        `**É este cliente?**`,
      pronto: false,
    };
  }

  return {
    draft: { ...draft, etapa: "escolher_cliente", candidatos: lista, termo_cliente: termo },
    mensagem:
      `Achei estes clientes. Qual você deseja?\n\n` +
      lista
        .slice(0, 8)
        .map(
          (c, i) =>
            `**${i + 1}. ${c.nome}** — ${mascararTelefone(c.telefone)} — ${c.bairro || "sem bairro"} — pets: ${c.pets?.map((p) => p.nome).join(", ") || "—"}`,
        )
        .join("\n"),
    pronto: false,
  };
}

async function proximaPergunta(draft: AgendaDraft): Promise<PassoFluxo> {
  // PET
  if (!draft.pet) {
    let pets = draft.cliente?.pets || [];
    if (pets.length === 0) {
      const resPets: any = await buscarPetsDoClienteIA({
        data: { cliente_id: draft.cliente!.id, comando_original: draft.comando_original },
      });
      pets = (resPets?.data || []).map((p: any) => ({ id: p.id, nome: p.nome }));
    }

    if (pets.length === 0) {
      return {
        draft: { ...draft, etapa: "pet" },
        mensagem: `O cliente **${draft.cliente?.nome}** não tem pet cadastrado. Cadastre o pet antes de agendar.`,
        pronto: false,
      };
    }
    if (pets.length === 1) {
      return proximaPergunta({ ...draft, pet: pets[0] });
    }
    return {
      draft: { ...draft, etapa: "pet", pets_candidatos: pets },
      mensagem:
        `Para qual pet de **${draft.cliente?.nome}** é o agendamento?\n\n` +
        pets.map((p, i) => `**${i + 1}. ${p.nome}**`).join("\n"),
      pronto: false,
    };
  }

  // SERVIÇO
  if (!draft.servico) {
    const resServ: any = await buscarServicosIA({
      data: { termo: draft.termo_servico || undefined, comando_original: draft.comando_original },
    });
    type ServicoFluxo = { id: string; nome: string; valor: number; duracao_min: number };
    let servicos: ServicoFluxo[] = (resServ?.data || []).map((s: any) => ({
      id: s.id,
      nome: s.nome,
      valor: Number(s.valor ?? s.preco_a_partir ?? 0),
      duracao_min: Number(s.duracao_min || 60),
    }));

    if (servicos.length === 0 && draft.termo_servico) {
      const resTodos: any = await buscarServicosIA({ data: { comando_original: draft.comando_original } });
      servicos = (resTodos?.data || []).map((s: any) => ({
        id: s.id,
        nome: s.nome,
        valor: Number(s.valor ?? s.preco_a_partir ?? 0),
        duracao_min: Number(s.duracao_min || 60),
      }));
    }

    if (servicos.length === 1) {
      return proximaPergunta({ ...draft, servico: servicos[0] });
    }
    if (servicos.length === 0) {
      return {
        draft: { ...draft, etapa: "servico" },
        mensagem: "Não encontrei serviços ativos cadastrados. Cadastre o serviço antes de agendar.",
        pronto: false,
      };
    }
    return {
      draft: { ...draft, etapa: "servico", servicos_candidatos: servicos },
      mensagem:
        `Qual serviço vamos agendar para **${draft.pet.nome}**?\n\n` +
        servicos
          .slice(0, 10)
          .map((s, i) => `**${i + 1}. ${s.nome}** — R$ ${s.valor.toFixed(2)} (${s.duracao_min} min)`)
          .join("\n"),
      pronto: false,
    };
  }

  // DATA
  if (!draft.data) {
    return {
      draft: { ...draft, etapa: "data" },
      mensagem: `Para qual **data**? (ex.: 28/08, 28 do 8, amanhã, próxima terça)`,
      pronto: false,
    };
  }

  // HORA
  if (!draft.hora) {
    return {
      draft: { ...draft, etapa: "hora" },
      mensagem: `Qual o **horário** do dia ${formatarData(draft.data)}? (ex.: 14h, 14:30, duas da tarde)`,
      pronto: false,
    };
  }

  // TRANSPORTE
  if (draft.transporte === null || draft.transporte === undefined) {
    return {
      draft: { ...draft, etapa: "transporte" },
      mensagem: `Vai usar **Leva e Traz** neste agendamento? (sim/não)`,
      pronto: false,
    };
  }

  // RESUMO
  const horaFim = somarMinutos(draft.hora, draft.servico.duracao_min);
  const taxa = draft.transporte ? Number(draft.taxa_transporte || 0) : 0;
  const valor = Number(draft.servico.valor || 0) + taxa;

  return {
    draft: { ...draft, etapa: "resumo" },
    mensagem:
      `### Confira o agendamento\n\n` +
      `- **Cliente:** ${draft.cliente?.nome}\n` +
      `- **Pet:** ${draft.pet.nome}\n` +
      `- **Serviço:** ${draft.servico.nome}\n` +
      `- **Data:** ${formatarData(draft.data)}\n` +
      `- **Horário:** ${draft.hora} às ${horaFim}\n` +
      `- **Profissional:** a definir na agenda\n` +
      `- **Transporte:** ${draft.transporte ? "Leva e Traz" : "Não utilizar"}\n` +
      `- **Taxa:** R$ ${taxa.toFixed(2)}\n` +
      `- **Valor total:** R$ ${valor.toFixed(2)}\n\n` +
      `Confirma o agendamento?`,
    pronto: true,
    parametros: {
      cliente_id: draft.cliente?.id,
      cliente_nome: draft.cliente?.nome,
      pet_id: draft.pet.id,
      pet_nome: draft.pet.nome,
      servicos: [{ id: draft.servico.id, nome: draft.servico.nome, valor: Number(draft.servico.valor || 0) }],
      data: draft.data,
      hora: draft.hora,
      duracao_min: draft.servico.duracao_min,
      transporte: !!draft.transporte,
      taxa_transporte: taxa,
      comando_original: draft.comando_original,
    },
  };
}

/** Aplica a resposta do usuário ao rascunho e devolve a próxima pergunta ou o resumo. */
export async function avancarFluxo(draftAtual: AgendaDraft, texto: string): Promise<PassoFluxo> {
  const draft = { ...draftAtual };
  const t = limpar(texto);

  // Cancelamento explícito
  if (/^(cancelar|cancela|deixa pra la|esquece)\b/.test(t)) {
    return { draft: null, mensagem: "Agendamento cancelado. Nada foi gravado.", pronto: false };
  }

  switch (draft.etapa) {
    case "cliente": {
      const termo = draft.termo_cliente || texto.trim();
      return buscarCliente(draft, termo);
    }

    case "cliente_inexistente": {
      if (ehSim(texto)) {
        return {
          draft: null,
          mensagem:
            "Certo. Abra **Clientes → Novo Cliente** para concluir o cadastro (nome, telefone e pet) e depois refaça o agendamento. Não cadastro ninguém automaticamente.",
          pronto: false,
        };
      }
      if (ehNao(texto)) {
        return { draft: null, mensagem: "Ok, agendamento interrompido.", pronto: false };
      }
      return buscarCliente({ ...draft, etapa: "cliente" }, texto.trim());
    }

    case "confirmar_cliente": {
      if (ehSim(texto)) {
        const cliente = draft.candidatos?.[0] || null;
        return proximaPergunta({ ...draft, cliente, candidatos: undefined });
      }
      if (ehNao(texto)) {
        return {
          draft: { ...draft, etapa: "cliente", termo_cliente: null },
          mensagem: "Sem problemas. Me diga o **nome completo** ou o **telefone** do cliente.",
          pronto: false,
        };
      }
      return buscarCliente({ ...draft, etapa: "cliente" }, texto.trim());
    }

    case "escolher_cliente": {
      const idx = interpretarEscolha(texto, draft.candidatos || []);
      if (idx === null) {
        return {
          draft,
          mensagem: "Não consegui identificar qual cliente. Responda com o número da lista, o nome completo, o pet ou o final do telefone.",
          pronto: false,
        };
      }
      return proximaPergunta({ ...draft, cliente: draft.candidatos![idx], candidatos: undefined });
    }

    case "pet": {
      const pets = draft.pets_candidatos || [];
      const porNome = pets.find((p) => limpar(p.nome) === t || t.includes(limpar(p.nome)));
      const idx = porNome ? pets.indexOf(porNome) : interpretarEscolha(texto, pets.map((p) => ({ nome: p.nome })));
      if (idx === null || idx < 0 || !pets[idx]) {
        return { draft, mensagem: "Qual pet? Responda com o nome ou o número da lista.", pronto: false };
      }
      return proximaPergunta({ ...draft, pet: pets[idx], pets_candidatos: undefined });
    }

    case "servico": {
      const servicos = draft.servicos_candidatos || [];
      const termo = detectarServico(texto) || t;
      const porNome = servicos.find((s) => limpar(s.nome) === termo || limpar(s.nome).includes(termo));
      const idx = porNome ? servicos.indexOf(porNome) : interpretarEscolha(texto, servicos.map((s) => ({ nome: s.nome })));
      if (idx === null || idx < 0 || !servicos[idx]) {
        return { draft, mensagem: "Qual serviço? Responda com o nome ou o número da lista.", pronto: false };
      }
      return proximaPergunta({ ...draft, servico: servicos[idx], servicos_candidatos: undefined });
    }

    case "data": {
      const data = interpretarData(texto, hojeSP());
      if (!data) {
        return { draft, mensagem: "Não entendi a data. Pode dizer assim: 28/08, 28 do 8, 28 de agosto, amanhã ou próxima terça.", pronto: false };
      }
      return proximaPergunta({ ...draft, data });
    }

    case "hora": {
      const hora = interpretarHora(texto);
      if (!hora) {
        return { draft, mensagem: "Não entendi o horário. Pode dizer assim: 14h, 14:30 ou duas da tarde.", pronto: false };
      }
      return proximaPergunta({ ...draft, hora });
    }

    case "transporte": {
      if (ehSim(texto)) return proximaPergunta({ ...draft, transporte: true });
      if (ehNao(texto)) return proximaPergunta({ ...draft, transporte: false });
      return { draft, mensagem: "Vai usar Leva e Traz? Responda **sim** ou **não**.", pronto: false };
    }

    case "resumo": {
      // Usuário pediu alteração dentro do resumo
      const data = interpretarData(texto, hojeSP());
      const hora = interpretarHora(texto);
      if (data || hora) {
        return proximaPergunta({ ...draft, data: data || draft.data, hora: hora || draft.hora });
      }
      if (/\bpet\b/.test(t)) return proximaPergunta({ ...draft, pet: null });
      if (/\bservico|banho|tosa\b/.test(t)) return proximaPergunta({ ...draft, servico: null, termo_servico: detectarServico(texto) });
      if (/\bcliente\b/.test(t)) {
        return { draft: { ...draft, etapa: "cliente", cliente: null, pet: null, termo_cliente: null }, mensagem: "Qual é o cliente correto?", pronto: false };
      }
      return proximaPergunta(draft);
    }

    default:
      return proximaPergunta(draft);
  }
}

/** Primeiro passo a partir de um comando livre (voz ou texto). */
export async function iniciarFluxo(texto: string): Promise<PassoFluxo> {
  const draft = iniciarDraft(texto);
  if (draft.termo_cliente) {
    return buscarCliente(draft, draft.termo_cliente);
  }
  return {
    draft: { ...draft, etapa: "cliente" },
    mensagem: "Vamos criar o agendamento. Qual é o **cliente**? (nome ou telefone)",
    pronto: false,
  };
}
