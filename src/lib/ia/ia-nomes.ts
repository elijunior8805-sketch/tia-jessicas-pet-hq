/**
 * Normalização e correspondência de nomes de clientes/pets.
 * Usado tanto no cliente (exibição) quanto no servidor (busca).
 */

const ABREVIACOES: Record<string, string> = {
  jr: "junior",
  "jr.": "junior",
  jnr: "junior",
  jnior: "junior",
  jún: "junior",
  jun: "junior",
  fo: "filho",
  fh: "filho",
  neto: "neto",
  sr: "",
  sra: "",
  dr: "",
  dra: "",
};

export function removerAcentos(texto: string): string {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** minúsculas, sem acento, sem pontuação, espaços simples, abreviações expandidas */
export function normalizarNome(texto: string): string {
  if (!texto) return "";
  const base = removerAcentos(texto.toLowerCase())
    .replace(/[^a-z0-9\s.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return base
    .split(" ")
    .map((tok) => {
      const semPonto = tok.replace(/\./g, "");
      if (ABREVIACOES[tok] !== undefined) return ABREVIACOES[tok];
      if (ABREVIACOES[semPonto] !== undefined) return ABREVIACOES[semPonto];
      return semPonto;
    })
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function apenasDigitos(texto: string): string {
  return (texto || "").replace(/\D/g, "");
}

/** Distância de Levenshtein */
export function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      atual[j] = Math.min(atual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + custo);
    }
    anterior = atual;
  }
  return anterior[b.length];
}

/** Código fonético simplificado para português (apoio, nunca decisão isolada) */
export function fonetica(texto: string): string {
  let t = normalizarNome(texto).replace(/\s/g, "");
  if (!t) return "";
  t = t
    .replace(/lh/g, "l")
    .replace(/nh/g, "n")
    .replace(/ch|x/g, "s")
    .replace(/ss|c(?=[ei])|ç/g, "s")
    .replace(/c/g, "k")
    .replace(/qu?/g, "k")
    .replace(/ph/g, "f")
    .replace(/[wy]/g, "u")
    .replace(/z/g, "s")
    .replace(/h/g, "")
    .replace(/rr/g, "r")
    .replace(/(.)\1+/g, "$1");
  return t;
}

export interface MatchNome {
  score: number;
  motivo: "exato" | "abreviacao" | "parcial" | "aproximado" | "fonetico" | "pet" | "telefone";
}

/**
 * Compara um termo de busca com o nome de um cliente.
 * Retorna null quando não há relação plausível.
 */
export function compararNome(termo: string, nome: string): MatchNome | null {
  const t = normalizarNome(termo);
  const n = normalizarNome(nome);
  if (!t || !n) return null;

  if (t === n) return { score: 1, motivo: "exato" };

  const tTokens = t.split(" ").filter(Boolean);
  const nTokens = n.split(" ").filter(Boolean);

  // Todos os tokens do termo presentes no nome (ex.: "eli junior" em "eli junior xavier")
  const todosPresentes = tTokens.every((tk) =>
    nTokens.some((nk) => nk === tk || (tk.length >= 3 && nk.startsWith(tk))),
  );
  if (todosPresentes) {
    return { score: 0.92, motivo: tTokens.length === nTokens.length ? "abreviacao" : "parcial" };
  }

  if (n.includes(t) || t.includes(n)) return { score: 0.8, motivo: "parcial" };

  // Aproximado: tolera pequenos erros de transcrição ("elis" -> "eli")
  const d = distancia(t, n);
  const limite = Math.max(1, Math.floor(Math.max(t.length, n.length) * 0.25));
  if (d <= limite) return { score: 0.7 - d * 0.05, motivo: "aproximado" };

  // Aproximado por primeiro token
  const dPrimeiro = distancia(tTokens[0] || "", nTokens[0] || "");
  if ((tTokens[0]?.length || 0) >= 3 && dPrimeiro <= 1) {
    return { score: 0.6, motivo: "aproximado" };
  }

  // Fonética como apoio
  if (fonetica(t) && fonetica(t) === fonetica(n)) return { score: 0.55, motivo: "fonetico" };
  const fTermo = fonetica(tTokens[0] || "");
  const fNome = fonetica(nTokens[0] || "");
  if (fTermo && fTermo === fNome && fTermo.length >= 3) return { score: 0.5, motivo: "fonetico" };

  return null;
}

/** Mascara o telefone deixando visível apenas o final. */
export function mascararTelefone(telefone?: string | null): string {
  const d = apenasDigitos(telefone || "");
  if (!d) return "não informado";
  if (d.length <= 4) return `••••${d}`;
  return `(${d.slice(0, 2)}) ••••-${d.slice(-4)}`;
}
