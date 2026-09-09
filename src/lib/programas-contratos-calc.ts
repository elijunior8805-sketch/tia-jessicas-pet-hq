export type SaldoServico = {
  servico_id: string;
  criado: number;
  consumido: number;
  reservado: number;
  disponivel: number;
};

/** Saldo por serviço de UM contrato específico (pacote comprado). */
export function calcularSaldoContrato(movs: any[]): Record<string, SaldoServico> {
  const mapa: Record<string, SaldoServico> = {};
  const get = (sid: string) => {
    if (!mapa[sid]) {
      mapa[sid] = { servico_id: sid, criado: 0, consumido: 0, reservado: 0, disponivel: 0 };
    }
    return mapa[sid];
  };

  for (const m of movs) {
    const s = get(m.servico_id);
    const q = Number(m.quantidade || 0);
    switch (m.tipo) {
      case "credito_criado":
        s.criado += q;
        break;
      case "ajuste_manual":
        s.criado += q;
        break;
      case "credito_consumido":
        s.consumido += q;
        s.reservado = Math.max(0, s.reservado - q);
        break;
      case "credito_reservado":
        s.reservado += q;
        break;
      case "reserva_liberada":
        s.reservado = Math.max(0, s.reservado - q);
        break;
      case "credito_expirado":
      case "cancelamento":
        s.criado -= q;
        break;
    }
    s.disponivel = Math.max(0, s.criado - s.consumido - s.reservado);
  }
  return mapa;
}
