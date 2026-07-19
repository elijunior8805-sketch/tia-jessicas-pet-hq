export type CepInfo = {
  cep: string;
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
};

/**
 * Consulta ViaCEP. Nunca lança — retorna null em falha para não bloquear cadastro.
 */
export async function lookupCep(cepRaw: string): Promise<CepInfo | null> {
  const cep = (cepRaw || "").replace(/\D/g, "");
  if (cep.length !== 8) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const j: any = await res.json();
    if (j?.erro) return null;
    return {
      cep: j.cep ?? cepRaw,
      rua: j.logradouro ?? "",
      bairro: j.bairro ?? "",
      cidade: j.localidade ?? "",
      estado: j.uf ?? "",
    };
  } catch {
    return null;
  }
}

export function formatCep(v: string) {
  const d = (v || "").replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
