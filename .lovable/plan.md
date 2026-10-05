# Destravar o motor Groq da Jessi

## Resultado
A Jessi flutuante e o Modo Bancada usarão o Groq como motor principal para interpretar pedidos, escolher ferramentas e concluir consultas com dados reais.

## Implementação
- Corrigir a configuração do Groq para usar apenas a chave segura do servidor, o modelo disponível na conta e um tempo adequado para chamadas com ferramentas.
- Remover o fallback silencioso para o motor antigo. Se o Groq falhar, continuar somente consultas determinísticas seguras e bloquear gravações.
- Garantir que o catálogo completo de ferramentas autorizadas seja oferecido ao Groq e que resultados de erro nunca sejam apresentados como sucesso.
- Carregar e aplicar no servidor as permissões reais do usuário antes de qualquer ferramenta.
- Manter validação de parâmetros, prevenção de duplicidade, auditoria e verificação do resultado de cada operação.
- Corrigir os erros atuais de compilação que impedem validar os dois modos.
- Testar chamada Groq com ferramenta, consulta real autenticada e preparação de operação pela Jessi flutuante e pelo Modo Bancada.

## Limite de segurança
Apesar da preferência por autonomia total, gravações, cancelamentos e operações financeiras continuarão exigindo confirmação explícita. Essa regra já é obrigatória no sistema e evita alterações irreversíveis ou indevidas; o Groq fará sozinho toda a interpretação, busca, validação e preparação anterior.
