import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getEstoqueIA = createServerFn({ method: "GET" })
  .inputValidator((input: any) => z.object({ 
    termo: z.string().optional(),
    categoria: z.string().optional(),
    apenasBaixo: z.boolean().optional(),
    comando_original: z.string().nullish(),
  }).parse(input || {}))
  .handler(async ({ data }) => {
    const { consultarEstoque } = await import("./ia-estoque.server");
    return consultarEstoque(data);
  });

export const getComprasIA = createServerFn({ method: "GET" })
  .inputValidator((input: any) => z.object({ 
    status: z.string().optional(),
    comando_original: z.string().optional().default("compras"),
  }).parse(input || {}))
  .handler(async ({ data }) => {
    const { consultarComprasAbertas } = await import("./ia-estoque.server");
    return consultarComprasAbertas(data.status);
  });

export const getFornecedoresIA = createServerFn({ method: "GET" })
  .inputValidator((input: any) => z.object({ 
    termo: z.string().optional(),
    comando_original: z.string().optional().default("fornecedores"),
  }).parse(input || {}))
  .handler(async ({ data }) => {
    const { consultarFornecedores } = await import("./ia-estoque.server");
    return consultarFornecedores(data.termo);
  });

export const getSugestoesCompraIA = createServerFn({ method: "GET" })
  .handler(async () => {
    const { sugerirCompras } = await import("./ia-estoque.server");
    return sugerirCompras();
  });

export const getAnomaliasEstoqueIA = createServerFn({ method: "GET" })
  .handler(async () => {
    const { detectarAnomaliasEstoque } = await import("./ia-estoque.server");
    return detectarAnomaliasEstoque();
  });
