/**
 * Cache curto em memória para respostas de IA (server-only).
 *
 * Objetivo: evitar gasto de crédito e espera desnecessária quando a MESMA
 * geração/refino é pedida novamente em poucos minutos (clique duplo, reabrir
 * a tela, dois operadores no mesmo caso). Nunca substitui a aprovação humana:
 * apenas devolve o mesmo texto que já havia sido gerado.
 *
 * O cache é por instância do servidor e some no restart — é proposital,
 * nada aqui é fonte de verdade.
 */
const MAX_ITENS = 200;
const TTL_PADRAO_MS = 5 * 60 * 1000;
const mapa = new Map();
function limpar(agora) {
    for (const [k, v] of mapa) {
        if (v.expiraEm <= agora)
            mapa.delete(k);
    }
    while (mapa.size > MAX_ITENS) {
        const primeira = mapa.keys().next();
        if (primeira.done)
            break;
        mapa.delete(primeira.value);
    }
}
/** Hash estável e curto para montar chaves de cache a partir de textos longos. */
export function chaveCacheIa(...partes) {
    const bruto = partes.map((p) => String(p ?? "")).join("|");
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < bruto.length; i++) {
        const c = bruto.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
        h2 = Math.imul(h2 + c + i, 2246822519) >>> 0;
    }
    return `${h1.toString(36)}${h2.toString(36)}:${bruto.length}`;
}
export function lerCacheIa(chave) {
    const agora = Date.now();
    const item = mapa.get(chave);
    if (!item)
        return undefined;
    if (item.expiraEm <= agora) {
        mapa.delete(chave);
        return undefined;
    }
    // Renova a posição (LRU simples).
    mapa.delete(chave);
    mapa.set(chave, item);
    return item.valor;
}
export function gravarCacheIa(chave, valor, ttlMs = TTL_PADRAO_MS) {
    const agora = Date.now();
    limpar(agora);
    mapa.set(chave, { valor, expiraEm: agora + Math.max(1000, ttlMs) });
}
export function invalidarCacheIa(prefixo) {
    if (!prefixo) {
        mapa.clear();
        return;
    }
    for (const k of [...mapa.keys()])
        if (k.startsWith(prefixo))
            mapa.delete(k);
}
export function estatisticasCacheIa() {
    return { itens: mapa.size, limite: MAX_ITENS, ttlPadraoMs: TTL_PADRAO_MS };
}
