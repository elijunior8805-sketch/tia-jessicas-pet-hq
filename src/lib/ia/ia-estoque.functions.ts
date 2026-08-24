import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { 
  consultarEstoque, 
  consultarComprasAbertas, 
  consultarFornecedores,
  sugerirCompras,
  detectarAnomaliasEstoque
} from "./ia-estoque.server";

export const getEstoqueIA = createServerFn({ method: "GET" })
  .inputValidator((input: any) => z.object({ 
    termo: z.string().optional(),
    categoria: z.string().optional(),
    apenasBaixo: z.boolean().optional(),
    comando_original: z.string().optional().default("estoque"),
  }).parse(input || {}))
  .handler(async ({ data }) => {
    return consultarEstoque(data);
  });

export const getComprasIA = createServerFn({ method: "GET" })
  .inputValidator((input: any) => z.object({ 
    status: z.string().optional(),
    comando_original: z.string().optional().default("compras"),
  }).parse(input || {}))
  .handler(async ({ data }) => {
    return consultarComprasAbertas(data.status);
  });

export const getFornecedoresIA = createServerFn({ method: "GET" })
  .inputValidator((input: any) => z.object({ 
    termo: z.string().optional(),
    comando_original: z.string().optional().default("fornecedores"),
  }).parse(input || {}))
  .handler(async ({ data }) => {
    return consultarFornecedores(data.termo);
  });

export const getSugestoesCompraIA = createServerFn({ method: "GET" })
  .handler(async () => {
    return sugerirCompras();
  });

export const getAnomaliasEstoqueIA = createServerFn({ method: "GET" })
  .handler(async () => {
    return detectarAnomaliasEstoque();
  });
