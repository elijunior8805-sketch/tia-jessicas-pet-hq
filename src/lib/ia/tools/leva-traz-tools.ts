import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { JessiQueryResult } from "../jessi-contracts";

export interface ParadaRota {
  id: string;
  ordem: number;
  tipo: "busca" | "entrega";
  horarioEstimado: string;
  clienteNome: string;
  petNome: string;
  telefone?: string;
  enderecoCompleto: string;
  bairro?: string;
  servico: string;
  mensagemWhatsapp: string;
  whatsappUrl?: string;
}

export interface RotaLevaTrazResult {
  data: string;
  totalParadas: number;
  totalBuscas: number;
  totalEntregas: number;
  googleMapsUrl: string;
  resumoMotoristaWhatsapp: string;
  paradas: ParadaRota[];
}

export async function otimizarRotasLevaTrazJessi(
  sb: SupabaseClient<Database>,
  params: { data?: string }
): Promise<JessiQueryResult<RotaLevaTrazResult>> {
  const dataRef = params.data || new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // Busca agendamentos com modalidade Leva e Traz na data
  const { data: agendamentos, error } = await sb
    .from("agendamentos")
    .select(`
      id,
      data,
      hora,
      status,
      leva_traz_modalidade,
      clientes (
        id,
        nome,
        telefone,
        endereco,
        bairro,
        numero,
        complemento
      ),
      pets (
        id,
        nome,
        raca,
        porte
      ),
      servicos (
        id,
        nome
      )
    `)
    .eq("data", dataRef)
    .neq("leva_traz_modalidade", "nao_utilizar")
    .not("leva_traz_modalidade", "is", null)
    .order("hora", { ascending: true });

  if (error) {
    console.error("Erro ao buscar agendamentos Leva e Traz:", error);
  }

  const lista = (agendamentos as any[]) || [];

  const paradas: ParadaRota[] = [];
  let ordem = 1;

  // 1. Gera paradas de Busca (manhã / horário de início)
  const buscas = lista.filter(
    (a) => a.leva_traz_modalidade === "buscar_e_entregar" || a.leva_traz_modalidade === "apenas_buscar" || a.leva_traz_modalidade === "sim"
  );

  for (const a of buscas) {
    const tutor = a.clientes?.nome || "Cliente";
    const pet = a.pets?.nome || "Pet";
    const hora = a.hora ? String(a.hora).slice(0, 5) : "09:00";
    const rua = a.clientes?.endereco || "Endereço cadastrado";
    const num = a.clientes?.numero ? `, ${a.clientes.numero}` : "";
    const bairro = a.clientes?.bairro ? ` - ${a.clientes.bairro}` : "";
    const endCompleto = `${rua}${num}${bairro}`;
    const foneLimpo = (a.clientes?.telefone || "").replace(/\D/g, "");
    
    const msg = `Olá, ${tutor}! 🚗🐾 O motorista do Spa de Pet Tia Jéssica já está a caminho para buscar o(a) ${pet} para o horário das ${hora}! Por favor, deixe-o(a) prontinho(a). Até logo! 💚`;
    const waUrl = foneLimpo ? `https://wa.me/55${foneLimpo}?text=${encodeURIComponent(msg)}` : undefined;

    paradas.push({
      id: `${a.id}_busca`,
      ordem: ordem++,
      tipo: "busca",
      horarioEstimado: hora,
      clienteNome: tutor,
      petNome: pet,
      telefone: a.clientes?.telefone,
      enderecoCompleto: endCompleto,
      bairro: a.clientes?.bairro,
      servico: a.servicos?.nome || "Banho & Cuidado",
      mensagemWhatsapp: msg,
      whatsappUrl: waUrl,
    });
  }

  // 2. Gera paradas de Entrega (após atendimento)
  const entregas = lista.filter(
    (a) => a.leva_traz_modalidade === "buscar_e_entregar" || a.leva_traz_modalidade === "apenas_entregar"
  );

  for (const a of entregas) {
    const tutor = a.clientes?.nome || "Cliente";
    const pet = a.pets?.nome || "Pet";
    const horaOriginal = a.hora ? String(a.hora).slice(0, 5) : "09:00";
    const [h, m] = horaOriginal.split(":").map(Number);
    // Estima retorno 2 horas após
    const horaEstimadaEntrega = `${String(Math.min(h + 2, 18)).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;

    const rua = a.clientes?.endereco || "Endereço cadastrado";
    const num = a.clientes?.numero ? `, ${a.clientes.numero}` : "";
    const bairro = a.clientes?.bairro ? ` - ${a.clientes.bairro}` : "";
    const endCompleto = `${rua}${num}${bairro}`;
    const foneLimpo = (a.clientes?.telefone || "").replace(/\D/g, "");

    const msg = `Olá, ${tutor}! ✨🐾 O(A) ${pet} já está pronto(a), cheiroso(a) e muito feliz! Nosso motorista está saindo agora para entregá-lo(a) em casa. 🐶🛁💚`;
    const waUrl = foneLimpo ? `https://wa.me/55${foneLimpo}?text=${encodeURIComponent(msg)}` : undefined;

    paradas.push({
      id: `${a.id}_entrega`,
      ordem: ordem++,
      tipo: "entrega",
      horarioEstimado: horaEstimadaEntrega,
      clienteNome: tutor,
      petNome: pet,
      telefone: a.clientes?.telefone,
      enderecoCompleto: endCompleto,
      bairro: a.clientes?.bairro,
      servico: a.servicos?.nome || "Retorno para Casa",
      mensagemWhatsapp: msg,
      whatsappUrl: waUrl,
    });
  }

  // Monta link do Google Maps com os endereços
  const enderecosValidos = paradas
    .map((p) => p.enderecoCompleto)
    .filter((e) => e && e !== "Endereço cadastrado");

  let googleMapsUrl = "https://www.google.com/maps";
  if (enderecosValidos.length > 0) {
    const destinos = enderecosValidos.map((e) => encodeURIComponent(e)).join("/");
    googleMapsUrl = `https://www.google.com/maps/dir/${destinos}`;
  }

  // Monta texto formatado para enviar no WhatsApp do motorista
  let resumoMotorista = `🚐 *ITINERÁRIO LEVA E TRAZ · ${dataRef}*\n_Spa de Pet Tia Jéssica_\n\n`;
  if (paradas.length === 0) {
    resumoMotorista += "Nenhuma corrida agendada para este dia.";
  } else {
    paradas.forEach((p) => {
      const icone = p.tipo === "busca" ? "🟢 [BUSCA]" : "🏠 [ENTREGA]";
      resumoMotorista += `${p.ordem}. ${icone} *${p.horarioEstimado}* - ${p.petNome} (${p.clienteNome})\n📍 ${p.enderecoCompleto}\n📞 ${p.telefone || "Sem telefone"}\n\n`;
    });
    if (enderecosValidos.length > 0) {
      resumoMotorista += `🗺️ *Abrir rota no Maps:*\n${googleMapsUrl}`;
    }
  }

  const resultData: RotaLevaTrazResult = {
    data: dataRef,
    totalParadas: paradas.length,
    totalBuscas: buscas.length,
    totalEntregas: entregas.length,
    googleMapsUrl,
    resumoMotoristaWhatsapp: resumoMotorista,
    paradas,
  };

  let summary = "";
  if (paradas.length === 0) {
    summary = `Não há corridas de Leva e Traz agendadas para ${dataRef}.`;
  } else {
    summary = `Itinerário otimizado para ${dataRef} gerado com sucesso! Total de ${paradas.length} parada(s) (${buscas.length} buscas e ${entregas.length} entregas).`;
  }

  return {
    success: true,
    source: "otimizar_rotas_leva_traz",
    data: resultData,
    executed_at: new Date().toISOString(),
    summary,
  };
}

export async function sugerirEncaixesReativacaoJessi(
  sb: SupabaseClient<Database>,
  params: { data?: string }
): Promise<JessiQueryResult> {
  const dataRef = params.data || new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // 1. Busca horários ocupados na data
  const { data: agendamentosHoje } = await sb
    .from("agendamentos")
    .select("hora")
    .eq("data", dataRef);

  const slotsPadrao = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
  const horasOcupadas = new Set((agendamentosHoje || []).map((a: any) => a.hora?.slice(0, 5)));
  const horariosLivres = slotsPadrao.filter((h) => !horasOcupadas.has(h));

  // 2. Busca clientes ativos com pets
  const { data: clientes } = await sb
    .from("clientes")
    .select(`
      id,
      nome,
      telefone,
      bairro,
      pets (
        id,
        nome,
        raca,
        porte
      )
    `)
    .eq("ativo", true)
    .limit(8);

  const listaClientes = clientes || [];

  const sugestoesEncaixe = listaClientes.slice(0, 4).map((c: any, index: number) => {
    const petNome = Array.isArray(c.pets) && c.pets.length > 0 ? c.pets[0].nome : "seu pet";
    const horaSugerida = horariosLivres[index % (horariosLivres.length || 1)] || "14:00";
    const foneLimpo = (c.telefone || "").replace(/\D/g, "");
    const msg = `Olá, ${c.nome}! Tudo bem? 🐶✨ Notamos que o ${petNome} está sem vir ao Spa há algum tempo. Temos uma vaga especial amanhã às ${horaSugerida} com hidratação inclusa! Podemos reservar para você? 🐾🛁`;
    const waUrl = foneLimpo ? `https://wa.me/55${foneLimpo}?text=${encodeURIComponent(msg)}` : undefined;

    return {
      clienteId: c.id,
      clienteNome: c.nome,
      petNome,
      telefone: c.telefone,
      bairro: c.bairro,
      horarioSugerido: horaSugerida,
      mensagemWhatsapp: msg,
      whatsappUrl: waUrl,
    };
  });

  const summary = `Identifiquei ${horariosLivres.length} horário(s) livre(s) para ${dataRef} (${horariosLivres.join(", ") || "agenda cheia"}). Selecionei ${sugestoesEncaixe.length} cliente(s) frequentes com mensagens prontas para convidar no WhatsApp.`;

  return {
    success: true,
    source: "sugerir_encaixes_reativacao",
    data: {
      data: dataRef,
      horariosLivres,
      sugestoes: sugestoesEncaixe,
    },
    executed_at: new Date().toISOString(),
    summary,
  };
}
