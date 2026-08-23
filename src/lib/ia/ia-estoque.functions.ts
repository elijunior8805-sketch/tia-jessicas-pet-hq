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
  .inputValidator((d) => z.object({ 
    termo: z.string().optional(),
    categoria: z.string().optional(),
    apenasBaixo: z.boolean().optional() 
  }).parse(d))
  .handler(async ({ data }) => {
    return consultarEstoque(data);
  });

export const getComprasIA = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ 
    status: z.string().optional()
  }).parse(d))
  .handler(async ({ data }) => {
    return consultarComprasAbertas(data.status);
  });

export const getFornecedoresIA = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ 
    termo: z.string().optional()
  }).parse(d))
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
