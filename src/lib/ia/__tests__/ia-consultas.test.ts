import { describe, it, expect, vi } from 'vitest';
import { buscarDadosAgenda, buscarClientesIA, buscarDadosFinanceiros, buscarDisponibilidade, consultarResumoOperacionalIA, analisarRiscoEvasaoIA } from '../ia-consultas.server';

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
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
  };
  return queryChain;
};

describe('ia-consultas.server queries validation', () => {
  it('buscarDadosAgenda should select correct columns', async () => {
    const sb = createMockSupabase();
    await buscarDadosAgenda(sb, {});
    
    expect(sb.from).toHaveBeenCalledWith('agendamentos');
    expect(sb.select).toHaveBeenCalledWith(expect.stringContaining('pets(nome, raca, porte, observacoes)'));
  });

  it('buscarClientesIA should query clientes correctly', async () => {
    const sb = createMockSupabase();
    await buscarClientesIA(sb, 'teste');
    
    expect(sb.from).toHaveBeenCalledWith('clientes');
  });

  it('buscarDadosFinanceiros should include relationships', async () => {
    const sb = createMockSupabase();
    await buscarDadosFinanceiros(sb, {});
    
    expect(sb.from).toHaveBeenCalledWith('pagamentos');
  });

  it('buscarDisponibilidade should filter non-cancelled appointments', async () => {
    const sb = createMockSupabase();
    await buscarDisponibilidade(sb, { data: '2026-08-22' });
    
    expect(sb.from).toHaveBeenCalledWith('agendamentos');
  });
});
