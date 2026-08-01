/** Helpers server-only da configuração da IA (fora do módulo de server functions). */

/** Retorna true quando o usuário é admin ou proprietário. */
export async function podeGerenciarIa(sb: any, userId: string): Promise<boolean> {
  try {
    const [admin, dono] = await Promise.all([
      sb.rpc("has_role", { _user_id: userId, _role: "admin" }),
      sb.rpc("is_proprietario", { _user_id: userId }),
    ]);
    return !!admin.data || !!dono.data;
  } catch {
    return false;
  }
}

/** Bloqueia a operação quando o usuário não pode gerenciar a IA. */
export async function garantirAdminIa(sb: any, userId: string): Promise<void> {
  if (!(await podeGerenciarIa(sb, userId))) {
    throw new Error("Somente administradores podem alterar as configurações da IA.");
  }
}
