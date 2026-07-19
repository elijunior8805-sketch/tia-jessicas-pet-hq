export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          cliente_id: string
          created_at: string
          data: string
          duracao_min: number
          hora: string
          id: string
          observacoes: string | null
          pet_id: string
          profissional_id: string | null
          servico_id: string | null
          status: Database["public"]["Enums"]["agendamento_status"]
          taxa_leva_traz: number
          updated_at: string
          valor_previsto: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data: string
          duracao_min?: number
          hora: string
          id?: string
          observacoes?: string | null
          pet_id: string
          profissional_id?: string | null
          servico_id?: string | null
          status?: Database["public"]["Enums"]["agendamento_status"]
          taxa_leva_traz?: number
          updated_at?: string
          valor_previsto?: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data?: string
          duracao_min?: number
          hora?: string
          id?: string
          observacoes?: string | null
          pet_id?: string
          profissional_id?: string | null
          servico_id?: string | null
          status?: Database["public"]["Enums"]["agendamento_status"]
          taxa_leva_traz?: number
          updated_at?: string
          valor_previsto?: number
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimentos: {
        Row: {
          agendamento_id: string | null
          alergia_observada: string | null
          check_in_foto: string | null
          check_in_obs: string | null
          cliente_id: string
          comportamentos: string[] | null
          created_at: string
          data_fim: string | null
          data_inicio: string
          desconto: number
          desconto_motivo: string | null
          encerrado_em: string | null
          encerrado_por: string | null
          etapa_atual: number
          etapas_status: Json
          finalizado: boolean
          foto_principal_depois: string | null
          fotos_antes: Json | null
          fotos_depois: Json | null
          id: string
          observacoes: string | null
          observacoes_checkin: string | null
          observacoes_internas: string | null
          pagamento_forma: string | null
          pagamento_status: string | null
          pdf_path: string | null
          pet_id: string
          precisou_pausa: boolean
          profissional_id: string | null
          proxima_visita: string | null
          reaberto_motivo: string | null
          recomendacoes: string | null
          servicos_executados: Json
          servicos_extras: Json
          servicos_planejados: Json
          servicos_solicitados: Json
          taxa_leva_traz: number
          updated_at: string
          usou_focinheira: boolean
          valor_executado: number
          valor_pago: number
          valor_planejado: number
        }
        Insert: {
          agendamento_id?: string | null
          alergia_observada?: string | null
          check_in_foto?: string | null
          check_in_obs?: string | null
          cliente_id: string
          comportamentos?: string[] | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          desconto?: number
          desconto_motivo?: string | null
          encerrado_em?: string | null
          encerrado_por?: string | null
          etapa_atual?: number
          etapas_status?: Json
          finalizado?: boolean
          foto_principal_depois?: string | null
          fotos_antes?: Json | null
          fotos_depois?: Json | null
          id?: string
          observacoes?: string | null
          observacoes_checkin?: string | null
          observacoes_internas?: string | null
          pagamento_forma?: string | null
          pagamento_status?: string | null
          pdf_path?: string | null
          pet_id: string
          precisou_pausa?: boolean
          profissional_id?: string | null
          proxima_visita?: string | null
          reaberto_motivo?: string | null
          recomendacoes?: string | null
          servicos_executados?: Json
          servicos_extras?: Json
          servicos_planejados?: Json
          servicos_solicitados?: Json
          taxa_leva_traz?: number
          updated_at?: string
          usou_focinheira?: boolean
          valor_executado?: number
          valor_pago?: number
          valor_planejado?: number
        }
        Update: {
          agendamento_id?: string | null
          alergia_observada?: string | null
          check_in_foto?: string | null
          check_in_obs?: string | null
          cliente_id?: string
          comportamentos?: string[] | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          desconto?: number
          desconto_motivo?: string | null
          encerrado_em?: string | null
          encerrado_por?: string | null
          etapa_atual?: number
          etapas_status?: Json
          finalizado?: boolean
          foto_principal_depois?: string | null
          fotos_antes?: Json | null
          fotos_depois?: Json | null
          id?: string
          observacoes?: string | null
          observacoes_checkin?: string | null
          observacoes_internas?: string | null
          pagamento_forma?: string | null
          pagamento_status?: string | null
          pdf_path?: string | null
          pet_id?: string
          precisou_pausa?: boolean
          profissional_id?: string | null
          proxima_visita?: string | null
          reaberto_motivo?: string | null
          recomendacoes?: string | null
          servicos_executados?: Json
          servicos_extras?: Json
          servicos_planejados?: Json
          servicos_solicitados?: Json
          taxa_leva_traz?: number
          updated_at?: string
          usou_focinheira?: boolean
          valor_executado?: number
          valor_pago?: number
          valor_planejado?: number
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: true
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      categorias_financeiras: {
        Row: {
          ativo: boolean
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          id?: string
          nome: string
          tipo: string
        }
        Update: {
          ativo?: boolean
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: []
      }
      centros_custo: {
        Row: {
          ativo: boolean
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          id?: string
          nome?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          email: string | null
          estado: string | null
          id: string
          indicacao: string | null
          nascimento: string | null
          nome: string
          numero: string | null
          observacoes: string | null
          rua: string | null
          telefone: string | null
          updated_at: string
          vip: boolean
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          id?: string
          indicacao?: string | null
          nascimento?: string | null
          nome: string
          numero?: string | null
          observacoes?: string | null
          rua?: string | null
          telefone?: string | null
          updated_at?: string
          vip?: boolean
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          id?: string
          indicacao?: string | null
          nascimento?: string | null
          nome?: string
          numero?: string | null
          observacoes?: string | null
          rua?: string | null
          telefone?: string | null
          updated_at?: string
          vip?: boolean
          whatsapp?: string | null
        }
        Relationships: []
      }
      compras: {
        Row: {
          anexo_url: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          created_at: string
          data_compra: string
          data_recebimento: string | null
          descricao: string | null
          forma_pagamento: Database["public"]["Enums"]["pagamento_forma"]
          fornecedor_id: string
          id: string
          numero_documento: string | null
          observacoes: string | null
          parcelas: number
          primeiro_vencimento: string | null
          recebido: boolean
          updated_at: string
          valor_total: number
        }
        Insert: {
          anexo_url?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          created_at?: string
          data_compra?: string
          data_recebimento?: string | null
          descricao?: string | null
          forma_pagamento?: Database["public"]["Enums"]["pagamento_forma"]
          fornecedor_id: string
          id?: string
          numero_documento?: string | null
          observacoes?: string | null
          parcelas?: number
          primeiro_vencimento?: string | null
          recebido?: boolean
          updated_at?: string
          valor_total: number
        }
        Update: {
          anexo_url?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          created_at?: string
          data_compra?: string
          data_recebimento?: string | null
          descricao?: string | null
          forma_pagamento?: Database["public"]["Enums"]["pagamento_forma"]
          fornecedor_id?: string
          id?: string
          numero_documento?: string | null
          observacoes?: string | null
          parcelas?: number
          primeiro_vencimento?: string | null
          recebido?: boolean
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      compras_parcelas: {
        Row: {
          compra_id: string
          comprovante_url: string | null
          created_at: string
          data_pagamento: string | null
          desconto: number | null
          forma_pagamento: Database["public"]["Enums"]["pagamento_forma"] | null
          id: string
          juros: number | null
          multa: number | null
          numero: number
          observacoes: string | null
          status: Database["public"]["Enums"]["parcela_status"]
          total_parcelas: number
          updated_at: string
          valor: number
          valor_pago: number
          vencimento: string
        }
        Insert: {
          compra_id: string
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          desconto?: number | null
          forma_pagamento?:
            | Database["public"]["Enums"]["pagamento_forma"]
            | null
          id?: string
          juros?: number | null
          multa?: number | null
          numero: number
          observacoes?: string | null
          status?: Database["public"]["Enums"]["parcela_status"]
          total_parcelas: number
          updated_at?: string
          valor: number
          valor_pago?: number
          vencimento: string
        }
        Update: {
          compra_id?: string
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          desconto?: number | null
          forma_pagamento?:
            | Database["public"]["Enums"]["pagamento_forma"]
            | null
          id?: string
          juros?: number | null
          multa?: number | null
          numero?: number
          observacoes?: string | null
          status?: Database["public"]["Enums"]["parcela_status"]
          total_parcelas?: number
          updated_at?: string
          valor?: number
          valor_pago?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "compras_parcelas_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_config: {
        Row: {
          cnpj: string | null
          email: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          nome_fantasia: string
          razao_social: string | null
          taxa_leva_traz_padrao: number | null
          telefone: string | null
          updated_at: string
          whatsapp: string | null
          whatsapp_assinatura: string
          whatsapp_template_pagar: string
          whatsapp_template_receber: string
        }
        Insert: {
          cnpj?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome_fantasia?: string
          razao_social?: string | null
          taxa_leva_traz_padrao?: number | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_assinatura?: string
          whatsapp_template_pagar?: string
          whatsapp_template_receber?: string
        }
        Update: {
          cnpj?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome_fantasia?: string
          razao_social?: string | null
          taxa_leva_traz_padrao?: number | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_assinatura?: string
          whatsapp_template_pagar?: string
          whatsapp_template_receber?: string
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          ativo: boolean
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          razao_social: string | null
          telefone: string | null
          tipo_produto: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          razao_social?: string | null
          telefone?: string | null
          tipo_produto?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          razao_social?: string | null
          telefone?: string | null
          tipo_produto?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      movimentos_estoque: {
        Row: {
          compra_id: string | null
          created_at: string
          custo_unitario: number | null
          id: string
          observacoes: string | null
          produto_id: string
          quantidade: number
          tipo: string
        }
        Insert: {
          compra_id?: string | null
          created_at?: string
          custo_unitario?: number | null
          id?: string
          observacoes?: string | null
          produto_id: string
          quantidade: number
          tipo: string
        }
        Update: {
          compra_id?: string | null
          created_at?: string
          custo_unitario?: number | null
          id?: string
          observacoes?: string | null
          produto_id?: string
          quantidade?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentos_estoque_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos_estoque"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencias: {
        Row: {
          atendimento_id: string | null
          cliente_id: string
          created_at: string
          descricao: string
          fotos: Json | null
          id: string
          observacoes: string | null
          pet_id: string
          profissional_id: string | null
          tipo: Database["public"]["Enums"]["ocorrencia_tipo"]
          tutor_informado: boolean
        }
        Insert: {
          atendimento_id?: string | null
          cliente_id: string
          created_at?: string
          descricao: string
          fotos?: Json | null
          id?: string
          observacoes?: string | null
          pet_id: string
          profissional_id?: string | null
          tipo: Database["public"]["Enums"]["ocorrencia_tipo"]
          tutor_informado?: boolean
        }
        Update: {
          atendimento_id?: string | null
          cliente_id?: string
          created_at?: string
          descricao?: string
          fotos?: Json | null
          id?: string
          observacoes?: string | null
          pet_id?: string
          profissional_id?: string | null
          tipo?: Database["public"]["Enums"]["ocorrencia_tipo"]
          tutor_informado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          atendimento_id: string | null
          cliente_id: string
          created_at: string
          data_pagamento: string | null
          forma: Database["public"]["Enums"]["pagamento_forma"]
          id: string
          observacoes: string | null
          status: Database["public"]["Enums"]["pagamento_status"]
          updated_at: string
          valor_pago: number
          valor_total: number
          vencimento: string | null
        }
        Insert: {
          atendimento_id?: string | null
          cliente_id: string
          created_at?: string
          data_pagamento?: string | null
          forma?: Database["public"]["Enums"]["pagamento_forma"]
          id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["pagamento_status"]
          updated_at?: string
          valor_pago?: number
          valor_total: number
          vencimento?: string | null
        }
        Update: {
          atendimento_id?: string | null
          cliente_id?: string
          created_at?: string
          data_pagamento?: string | null
          forma?: Database["public"]["Enums"]["pagamento_forma"]
          id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["pagamento_status"]
          updated_at?: string
          valor_pago?: number
          valor_total?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          alergias: string | null
          ativo: boolean
          castrado: boolean | null
          cliente_id: string
          cor: string | null
          created_at: string
          cuidados_saude: string | null
          foto_url: string | null
          id: string
          nascimento: string | null
          necessita_focinheira: boolean
          nome: string
          observacoes: string | null
          peso: number | null
          porte: string | null
          preferencias_tutor: string | null
          proxima_visita: string | null
          raca: string | null
          sexo: string | null
          temperamento: string | null
          ultima_tosa: string | null
          ultimo_banho: string | null
          updated_at: string
        }
        Insert: {
          alergias?: string | null
          ativo?: boolean
          castrado?: boolean | null
          cliente_id: string
          cor?: string | null
          created_at?: string
          cuidados_saude?: string | null
          foto_url?: string | null
          id?: string
          nascimento?: string | null
          necessita_focinheira?: boolean
          nome: string
          observacoes?: string | null
          peso?: number | null
          porte?: string | null
          preferencias_tutor?: string | null
          proxima_visita?: string | null
          raca?: string | null
          sexo?: string | null
          temperamento?: string | null
          ultima_tosa?: string | null
          ultimo_banho?: string | null
          updated_at?: string
        }
        Update: {
          alergias?: string | null
          ativo?: boolean
          castrado?: boolean | null
          cliente_id?: string
          cor?: string | null
          created_at?: string
          cuidados_saude?: string | null
          foto_url?: string | null
          id?: string
          nascimento?: string | null
          necessita_focinheira?: boolean
          nome?: string
          observacoes?: string | null
          peso?: number | null
          porte?: string | null
          preferencias_tutor?: string | null
          proxima_visita?: string | null
          raca?: string | null
          sexo?: string | null
          temperamento?: string | null
          ultima_tosa?: string | null
          ultimo_banho?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pets_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      portes: {
        Row: {
          ativo: boolean
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      produtos_estoque: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          custo_medio: number
          estoque_minimo: number
          fornecedor_id: string | null
          id: string
          nome: string
          quantidade: number
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          custo_medio?: number
          estoque_minimo?: number
          fornecedor_id?: string | null
          id?: string
          nome: string
          quantidade?: number
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          custo_medio?: number
          estoque_minimo?: number
          fornecedor_id?: string | null
          id?: string
          nome?: string
          quantidade?: number
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_estoque_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      racas: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      recibos_enviados: {
        Row: {
          contraparte: string | null
          created_at: string
          enviado_em: string
          enviado_por: string | null
          id: string
          mensagem: string | null
          numero_recibo: string
          referencia_id: string
          signed_url: string | null
          storage_path: string | null
          telefone: string | null
          tipo: string
          valor: number
        }
        Insert: {
          contraparte?: string | null
          created_at?: string
          enviado_em?: string
          enviado_por?: string | null
          id?: string
          mensagem?: string | null
          numero_recibo: string
          referencia_id: string
          signed_url?: string | null
          storage_path?: string | null
          telefone?: string | null
          tipo: string
          valor: number
        }
        Update: {
          contraparte?: string | null
          created_at?: string
          enviado_em?: string
          enviado_por?: string | null
          id?: string
          mensagem?: string | null
          numero_recibo?: string
          referencia_id?: string
          signed_url?: string | null
          storage_path?: string | null
          telefone?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: []
      }
      servicos: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          descricao: string | null
          duracao_min: number
          id: string
          is_combo: boolean
          nome: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          duracao_min?: number
          id?: string
          is_combo?: boolean
          nome: string
          updated_at?: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          duracao_min?: number
          id?: string
          is_combo?: boolean
          nome?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      servicos_combo_itens: {
        Row: {
          combo_id: string
          created_at: string
          id: string
          quantidade: number
          servico_id: string
        }
        Insert: {
          combo_id: string
          created_at?: string
          id?: string
          quantidade?: number
          servico_id: string
        }
        Update: {
          combo_id?: string
          created_at?: string
          id?: string
          quantidade?: number
          servico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicos_combo_itens_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_combo_itens_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos_precos: {
        Row: {
          created_at: string
          id: string
          porte_id: string
          servico_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          porte_id: string
          servico_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          id?: string
          porte_id?: string
          servico_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "servicos_precos_porte_id_fkey"
            columns: ["porte_id"]
            isOneToOne: false
            referencedRelation: "portes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_precos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      temperamentos: {
        Row: {
          ativo: boolean
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          id?: string
          nome?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      excluir_atendimento: {
        Args: { _atendimento_id: string }
        Returns: undefined
      }
      gerar_parcelas_compra: {
        Args: { _compra_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      agendamento_status:
        | "agendado"
        | "confirmado"
        | "aguardando"
        | "em_atendimento"
        | "finalizado"
        | "cancelado"
        | "nao_compareceu"
      app_role: "admin" | "user"
      comportamento_pet:
        | "muito_tranquilo"
        | "tranquilo"
        | "agitado"
        | "muito_agitado"
        | "ansioso"
        | "medroso"
        | "agressivo"
        | "necessitou_focinheira"
        | "necessitou_pausa"
      ocorrencia_tipo:
        | "machucado"
        | "irritacao"
        | "pulgas_carrapatos"
        | "agressividade"
        | "servico_interrompido"
        | "acidente"
        | "outro"
      pagamento_forma: "pix" | "credito" | "debito" | "dinheiro" | "pendente"
      pagamento_status:
        | "pago"
        | "parcial"
        | "pendente"
        | "atrasado"
        | "cancelado"
      parcela_status: "pendente" | "pago" | "parcial" | "atrasado" | "cancelado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agendamento_status: [
        "agendado",
        "confirmado",
        "aguardando",
        "em_atendimento",
        "finalizado",
        "cancelado",
        "nao_compareceu",
      ],
      app_role: ["admin", "user"],
      comportamento_pet: [
        "muito_tranquilo",
        "tranquilo",
        "agitado",
        "muito_agitado",
        "ansioso",
        "medroso",
        "agressivo",
        "necessitou_focinheira",
        "necessitou_pausa",
      ],
      ocorrencia_tipo: [
        "machucado",
        "irritacao",
        "pulgas_carrapatos",
        "agressividade",
        "servico_interrompido",
        "acidente",
        "outro",
      ],
      pagamento_forma: ["pix", "credito", "debito", "dinheiro", "pendente"],
      pagamento_status: [
        "pago",
        "parcial",
        "pendente",
        "atrasado",
        "cancelado",
      ],
      parcela_status: ["pendente", "pago", "parcial", "atrasado", "cancelado"],
    },
  },
} as const
