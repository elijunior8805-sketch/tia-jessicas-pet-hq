import { describe, it, expect, vi } from 'vitest';
import { buscarDadosAgenda, buscarDadosClientesPets, buscarDadosFinanceiros, buscarDisponibilidade, consultarResumoOperacionalIA, analisarRiscoEvasaoIA } from '../ia-consultas.server';

// Mock do Supabase Client
const createMockSupabase = () => {
  const queryChain: any = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve({ data: [], error: null })),
  };
  return queryChain;
};

describe('ia-consultas.server queries validation', () => {
  it('buscarDadosAgenda should select correct columns', async () => {
    const sb = createMockSupabase();
    await buscarDadosAgenda(sb, {});
    
    expect(sb.from).toHaveBeenCalledWith('agendamentos');
    expect(sb.select).toHaveBeenCalledWith(expect.stringContaining('pets(nome, raca, porte, observacoes)'));
    expect(sb.select).toHaveBeenCalledWith(expect.stringContaining('clientes(nome, telefone)'));
    expect(sb.select).toHaveBeenCalledWith(expect.stringContaining('servicos(nome)'));
    // Garante que 'preco' não está sendo selecionado em servicos, pois causou erro anteriormente
    const selectArg = sb.select.mock.calls[0][0];
    expect(selectArg).not.toContain('servicos(nome, preco)');
  });

  it('buscarDadosClientesPets should query clientes and pets correctly', async () => {
    const sb = createMockSupabase();
    await buscarDadosClientesPets(sb, 'teste');
    
    expect(sb.from).toHaveBeenCalledWith('clientes');
    expect(sb.from).toHaveBeenCalledWith('pets');
  });

  it('buscarDadosFinanceiros should include relationships', async () => {
    const sb = createMockSupabase();
    await buscarDadosFinanceiros(sb, {});
    
    expect(sb.from).toHaveBeenCalledWith('pagamentos');
    expect(sb.select).toHaveBeenCalledWith(expect.stringContaining('atendimentos'));
  });

  it('buscarDisponibilidade should filter non-cancelled appointments', async () => {
    const sb = createMockSupabase();
    await buscarDisponibilidade(sb, { data: '2026-08-22' });
    
    expect(sb.from).toHaveBeenCalledWith('agendamentos');
    expect(sb.not).toHaveBeenCalledWith('status', 'eq', 'cancelado');
  });

  it('consultarResumoOperacionalIA should query agenda, payments and promises', async () => {
    const sb = createMockSupabase();
    await consultarResumoOperacionalIA(sb);
    
    expect(sb.from).toHaveBeenCalledWith('agendamentos');
    expect(sb.from).toHaveBeenCalledWith('pagamentos');
    expect(sb.from).toHaveBeenCalledWith('cobranca_promessas');
  });

  it('analisarRiscoEvasaoIA should query finished appointments', async () => {
    const sb = createMockSupabase();
    await analisarRiscoEvasaoIA(sb);
    
    expect(sb.from).toHaveBeenCalledWith('atendimentos');
    expect(sb.eq).toHaveBeenCalledWith('finalizado', true);
  });
});
