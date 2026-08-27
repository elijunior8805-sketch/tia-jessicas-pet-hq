// Camada de apresentação da Assistente: transforma dados reais do backend
// em respostas naturais. Nunca expõe nomes de ferramentas, JSON ou IDs técnicos.

const brl = (v: number) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dataBr = (iso?: string | null) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");

const hojeSp = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const STATUS_TEXTO: Record<string, string> = {
  agendado: "ainda sem confirmação",
  confirmado: "confirmado",
  aguardando: "aguardando",
  em_atendimento: "em atendimento",
  finalizado: "finalizado",
  cancelado: "cancelado",
  nao_compareceu: "não compareceu",
};

const LEVA_TRAZ_TEXTO: Record<string, string> = {
  somente_buscar: "somente busca",
  somente_entregar: "somente entrega",
  buscar_entregar: "busca e entrega",
};

export function montarRespostaResumoOperacional(r: any): string {
  const atendimentos: any[] = Array.isArray(r?.atendimentos) ? r.atendimentos : [];
  const total = Number(r?.total_agenda || 0);
  const confirmados = Number(r?.confirmados || 0);
  const semConfirmar = Math.max(total - confirmados - Number(r?.finalizados || 0) - Number(r?.em_atendimento || 0), 0);
  const levaTraz = Number(r?.leva_traz || 0);
  const recebido = Number(r?.recebido_hoje || 0);
  const pendente = Number(r?.valor_pendente || 0);
  const vencido = Number(r?.valor_vencido || 0);
  const aVencer = Number(r?.valor_a_vencer || 0);

  const partes: string[] = [];

  // Agenda
  if (total === 0) {
    partes.push(`Hoje (${dataBr(r?.data)}) você não tem nenhum atendimento na agenda.`);
  } else {
    partes.push(
      `Hoje (${dataBr(r?.data)}) você tem ${total} ${total === 1 ? "atendimento agendado" : "atendimentos agendados"}` +
        (confirmados > 0 ? `, sendo ${confirmados} já ${confirmados === 1 ? "confirmado" : "confirmados"}` : "") +
        (semConfirmar > 0 ? `${confirmados > 0 ? " e" : ","} ${semConfirmar} ainda sem confirmação` : "") +
        ".",
    );
  }

  const listaAgenda = atendimentos
    .map((a) => {
      const detalhes = [a.pet, a.cliente].filter(Boolean).join(" — tutor(a) ");
      const servico = a.servico ? ` • ${a.servico}` : "";
      const status = STATUS_TEXTO[a.status] ?? a.status;
      const lt = a.leva_traz ? ` • leva e traz: ${LEVA_TRAZ_TEXTO[a.leva_traz] ?? a.leva_traz}` : "";
      return `- **${a.hora}** ${detalhes}${servico} (${status})${lt}`;
    })
    .join("\n");

  // Leva e traz
  partes.push(
    levaTraz > 0
      ? `${levaTraz} ${levaTraz === 1 ? "pet usa" : "pets usam"} o serviço de leva e traz hoje.`
      : "Nenhum pet com leva e traz hoje.",
  );

  // Financeiro
  const fin: string[] = [];
  fin.push(recebido > 0 ? `você já recebeu ${brl(recebido)} hoje` : "ainda não houve recebimentos hoje");
  if (pendente > 0) {
    if (vencido > 0 && aVencer > 0) {
      fin.push(`e existem ${brl(pendente)} pendentes, sendo ${brl(vencido)} já vencidos e ${brl(aVencer)} a vencer`);
    } else if (vencido > 0) {
      fin.push(`e existem ${brl(pendente)} pendentes, todos vencidos`);
    } else {
      fin.push(`e existem ${brl(pendente)} pendentes, ainda dentro do prazo`);
    }
  } else {
    fin.push("e não há valores pendentes em aberto");
  }
  partes.push(`No financeiro, ${fin.join(" ")}.`);

  // Prioridade
  const prioridades: string[] = [];
  if (vencido > 0) prioridades.push("revisar as cobranças vencidas");
  if (semConfirmar > 0) prioridades.push(`confirmar ${semConfirmar === 1 ? "o atendimento" : "os atendimentos"} de hoje`);
  if (Number(r?.promessas_hoje || 0) > 0) prioridades.push(`acompanhar ${r.promessas_hoje} promessa(s) de pagamento para hoje`);
  if (r?.proximo_atendimento) {
    prioridades.push(
      `preparar o próximo atendimento das ${r.proximo_atendimento.hora} (${r.proximo_atendimento.pet ?? "pet"}${
        r.proximo_atendimento.servico ? ` • ${r.proximo_atendimento.servico}` : ""
      })`,
    );
  }

  let texto = partes.join(" ");
  if (listaAgenda) texto += `\n\n**Agenda de hoje**\n${listaAgenda}`;
  texto += prioridades.length
    ? `\n\n**Prioridade recomendada:** ${prioridades.join("; ")}.`
    : "\n\nNo momento não há nada urgente pedindo sua atenção.";
  texto += "\n\nQuer que eu detalhe a agenda, mostre os valores a receber ou comece uma cobrança?";
  return texto;
}

export function montarRespostaValoresAReceber(pendencias: any[]): string {
  if (!pendencias.length) {
    return "Boa notícia: no momento não há nenhum valor pendente de recebimento. Quer ver o faturamento do mês ou o resumo do dia?";
  }

  const hoje = hojeSp();
  const saldo = (p: any) => Number(p.saldo ?? Number(p.valor_total || 0) - Number(p.valor_pago || 0));
  const total = pendencias.reduce((acc, p) => acc + saldo(p), 0);
  const vencidas = pendencias.filter((p) => p.vencimento && String(p.vencimento) < hoje);
  const aVencer = pendencias.filter((p) => !p.vencimento || String(p.vencimento) >= hoje);
  const totalVencido = vencidas.reduce((acc, p) => acc + saldo(p), 0);
  const totalAVencer = total - totalVencido;
  const clientes = new Set(pendencias.map((p) => p.cliente_id).filter(Boolean)).size;

  const nomeDe = (p: any) => p.nome || p.clientes?.nome || p.atendimentos?.clientes?.nome || "Cliente sem nome cadastrado";

  const maisAntigas = vencidas
    .slice()
    .sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)))
    .slice(0, 3)
    .map((p) => `- ${nomeDe(p)} — ${brl(saldo(p))} (vencido em ${dataBr(p.vencimento)})`);

  const proximos = aVencer
    .filter((p) => p.vencimento)
    .slice()
    .sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)))
    .slice(0, 3)
    .map((p) => `- ${nomeDe(p)} — ${brl(saldo(p))} (vence em ${dataBr(p.vencimento)})`);

  let texto =
    `Você tem ${brl(total)} a receber, distribuídos entre ${clientes} ${clientes === 1 ? "cliente" : "clientes"}. ` +
    (totalVencido > 0
      ? `Desse total, ${brl(totalVencido)} já ${vencidas.length === 1 ? "está vencido" : "estão vencidos"}`
      : "Nenhum valor está vencido") +
    (totalAVencer > 0 ? ` e ${brl(totalAVencer)} ainda estão dentro do prazo.` : ".");

  if (maisAntigas.length) texto += `\n\n**Pendências mais antigas**\n${maisAntigas.join("\n")}`;
  if (proximos.length) texto += `\n\n**Próximos vencimentos**\n${proximos.join("\n")}`;

  texto +=
    "\n\nPosso mostrar quem está devendo, abrir o caso mais atrasado, filtrar somente os vencidos ou preparar uma cobrança. O que você prefere?";
  return texto;
}
