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
      access_denials: {
        Row: {
          acao: string | null
          codigo_erro: string | null
          created_at: string
          detalhes: Json | null
          id: string
          ip: string | null
          metodo: string | null
          modulo: string | null
          motivo: string
          rota: string | null
          tabela_alvo: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          acao?: string | null
          codigo_erro?: string | null
          created_at?: string
          detalhes?: Json | null
          id?: string
          ip?: string | null
          metodo?: string | null
          modulo?: string | null
          motivo: string
          rota?: string | null
          tabela_alvo?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string | null
          codigo_erro?: string | null
          created_at?: string
          detalhes?: Json | null
          id?: string
          ip?: string | null
          metodo?: string | null
          modulo?: string | null
          motivo?: string
          rota?: string | null
          tabela_alvo?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      agendamento_servicos: {
        Row: {
          agendamento_id: string
          created_at: string
          duracao_min: number | null
          id: string
          nome: string
          ordem: number
          servico_id: string
          updated_at: string
          valor_unit: number
        }
        Insert: {
          agendamento_id: string
          created_at?: string
          duracao_min?: number | null
          id?: string
          nome: string
          ordem?: number
          servico_id: string
          updated_at?: string
          valor_unit?: number
        }
        Update: {
          agendamento_id?: string
          created_at?: string
          duracao_min?: number | null
          id?: string
          nome?: string
          ordem?: number
          servico_id?: string
          updated_at?: string
          valor_unit?: number
        }
        Relationships: [
          {
            foreignKeyName: "agendamento_servicos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamento_servicos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["proximo_agendamento_id"]
          },
          {
            foreignKeyName: "agendamento_servicos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamentos: {
        Row: {
          busca_data: string | null
          busca_endereco: Json | null
          busca_hora: string | null
          cliente_id: string
          created_at: string
          created_by: string | null
          data: string
          duracao_min: number
          entrega_data: string | null
          entrega_endereco: Json | null
          entrega_hora: string | null
          hora: string
          id: string
          leva_traz_isencao_motivo: string | null
          leva_traz_isencao_por: string | null
          leva_traz_isento: boolean
          leva_traz_modalidade: Database["public"]["Enums"]["leva_traz_modalidade"]
          leva_traz_obs: string | null
          leva_traz_responsavel_id: string | null
          leva_traz_telefone: string | null
          observacoes: string | null
          pet_id: string
          profissional_id: string | null
          servico_id: string | null
          status: Database["public"]["Enums"]["agendamento_status"]
          taxa_leva_traz: number
          updated_at: string
          updated_by: string | null
          valor_previsto: number
          version: number
        }
        Insert: {
          busca_data?: string | null
          busca_endereco?: Json | null
          busca_hora?: string | null
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data: string
          duracao_min?: number
          entrega_data?: string | null
          entrega_endereco?: Json | null
          entrega_hora?: string | null
          hora: string
          id?: string
          leva_traz_isencao_motivo?: string | null
          leva_traz_isencao_por?: string | null
          leva_traz_isento?: boolean
          leva_traz_modalidade?: Database["public"]["Enums"]["leva_traz_modalidade"]
          leva_traz_obs?: string | null
          leva_traz_responsavel_id?: string | null
          leva_traz_telefone?: string | null
          observacoes?: string | null
          pet_id: string
          profissional_id?: string | null
          servico_id?: string | null
          status?: Database["public"]["Enums"]["agendamento_status"]
          taxa_leva_traz?: number
          updated_at?: string
          updated_by?: string | null
          valor_previsto?: number
          version?: number
        }
        Update: {
          busca_data?: string | null
          busca_endereco?: Json | null
          busca_hora?: string | null
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data?: string
          duracao_min?: number
          entrega_data?: string | null
          entrega_endereco?: Json | null
          entrega_hora?: string | null
          hora?: string
          id?: string
          leva_traz_isencao_motivo?: string | null
          leva_traz_isencao_por?: string | null
          leva_traz_isento?: boolean
          leva_traz_modalidade?: Database["public"]["Enums"]["leva_traz_modalidade"]
          leva_traz_obs?: string | null
          leva_traz_responsavel_id?: string | null
          leva_traz_telefone?: string | null
          observacoes?: string | null
          pet_id?: string
          profissional_id?: string | null
          servico_id?: string | null
          status?: Database["public"]["Enums"]["agendamento_status"]
          taxa_leva_traz?: number
          updated_at?: string
          updated_by?: string | null
          valor_previsto?: number
          version?: number
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
            foreignKeyName: "agendamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "agendamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "agendamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "agendamentos_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["pet_id"]
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
          created_by: string | null
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
          updated_by: string | null
          usou_focinheira: boolean
          valor_executado: number
          valor_pago: number
          valor_planejado: number
          version: number
        }
        Insert: {
          agendamento_id?: string | null
          alergia_observada?: string | null
          check_in_foto?: string | null
          check_in_obs?: string | null
          cliente_id: string
          comportamentos?: string[] | null
          created_at?: string
          created_by?: string | null
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
          updated_by?: string | null
          usou_focinheira?: boolean
          valor_executado?: number
          valor_pago?: number
          valor_planejado?: number
          version?: number
        }
        Update: {
          agendamento_id?: string | null
          alergia_observada?: string | null
          check_in_foto?: string | null
          check_in_obs?: string | null
          cliente_id?: string
          comportamentos?: string[] | null
          created_at?: string
          created_by?: string | null
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
          updated_by?: string | null
          usou_focinheira?: boolean
          valor_executado?: number
          valor_pago?: number
          valor_planejado?: number
          version?: number
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
            foreignKeyName: "atendimentos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: true
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["proximo_agendamento_id"]
          },
          {
            foreignKeyName: "atendimentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "atendimentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "atendimentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "atendimentos_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["pet_id"]
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
      campanhas: {
        Row: {
          agendada_para: string | null
          concluida_em: string | null
          created_at: string
          criado_por: string | null
          descricao: string | null
          filtros: Json
          id: string
          mensagem: string
          nome: string
          status: string
          total_destinatarios: number
          total_enviados: number
          total_falhas: number
          updated_at: string
        }
        Insert: {
          agendada_para?: string | null
          concluida_em?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          filtros?: Json
          id?: string
          mensagem: string
          nome: string
          status?: string
          total_destinatarios?: number
          total_enviados?: number
          total_falhas?: number
          updated_at?: string
        }
        Update: {
          agendada_para?: string | null
          concluida_em?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          filtros?: Json
          id?: string
          mensagem?: string
          nome?: string
          status?: string
          total_destinatarios?: number
          total_enviados?: number
          total_falhas?: number
          updated_at?: string
        }
        Relationships: []
      }
      campanhas_destinatarios: {
        Row: {
          campanha_id: string
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          enviado_em: string | null
          erro: string | null
          id: string
          mensagem_renderizada: string
          pet_id: string | null
          pet_nome: string | null
          status: string
          telefone: string | null
          tentativas: number
          updated_at: string
        }
        Insert: {
          campanha_id: string
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          mensagem_renderizada: string
          pet_id?: string | null
          pet_nome?: string | null
          status?: string
          telefone?: string | null
          tentativas?: number
          updated_at?: string
        }
        Update: {
          campanha_id?: string
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          mensagem_renderizada?: string
          pet_id?: string | null
          pet_nome?: string | null
          status?: string
          telefone?: string | null
          tentativas?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_destinatarios_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_destinatarios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_destinatarios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "campanhas_destinatarios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "campanhas_destinatarios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "campanhas_destinatarios_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_destinatarios_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["pet_id"]
          },
        ]
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
          created_by: string | null
          email: string | null
          estado: string | null
          foto_url: string | null
          id: string
          indicacao: string | null
          nascimento: string | null
          nome: string
          numero: string | null
          observacoes: string | null
          opt_out_comunicacao: boolean
          opt_out_em: string | null
          opt_out_motivo: string | null
          rua: string | null
          telefone: string | null
          tom_preferido: string | null
          updated_at: string
          updated_by: string | null
          version: number
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
          created_by?: string | null
          email?: string | null
          estado?: string | null
          foto_url?: string | null
          id?: string
          indicacao?: string | null
          nascimento?: string | null
          nome: string
          numero?: string | null
          observacoes?: string | null
          opt_out_comunicacao?: boolean
          opt_out_em?: string | null
          opt_out_motivo?: string | null
          rua?: string | null
          telefone?: string | null
          tom_preferido?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
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
          created_by?: string | null
          email?: string | null
          estado?: string | null
          foto_url?: string | null
          id?: string
          indicacao?: string | null
          nascimento?: string | null
          nome?: string
          numero?: string | null
          observacoes?: string | null
          opt_out_comunicacao?: boolean
          opt_out_em?: string | null
          opt_out_motivo?: string | null
          rua?: string | null
          telefone?: string | null
          tom_preferido?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          vip?: boolean
          whatsapp?: string | null
        }
        Relationships: []
      }
      cobranca_promessas: {
        Row: {
          cobranca_id: string
          created_at: string | null
          data_prometida: string
          id: string
          observacao: string | null
          responsavel_id: string | null
          status: string | null
          updated_at: string | null
          valor: number
        }
        Insert: {
          cobranca_id: string
          created_at?: string | null
          data_prometida: string
          id?: string
          observacao?: string | null
          responsavel_id?: string | null
          status?: string | null
          updated_at?: string | null
          valor: number
        }
        Update: {
          cobranca_id?: string
          created_at?: string | null
          data_prometida?: string
          id?: string
          observacao?: string | null
          responsavel_id?: string | null
          status?: string | null
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_promessas_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas: {
        Row: {
          arquivada_em: string | null
          arquivada_motivo: string | null
          arquivada_por: string | null
          atendimento_id: string | null
          cliente_id: string
          created_at: string
          created_by: string | null
          etapa_kanban: string | null
          id: string
          pagamento_id: string
          pausada: boolean
          pausada_motivo: string | null
          prioridade: string | null
          prioridade_justificativa: string | null
          promessa_data: string | null
          promessas_quebradas: number | null
          responsavel_id: string | null
          saldo: number
          status: Database["public"]["Enums"]["cobranca_status"]
          tentativas: number
          ultima_cobranca_em: string | null
          ultima_resposta_em: string | null
          updated_at: string
          updated_by: string | null
          valor_original: number
          valor_pago: number
          vencimento: string
          version: number
        }
        Insert: {
          arquivada_em?: string | null
          arquivada_motivo?: string | null
          arquivada_por?: string | null
          atendimento_id?: string | null
          cliente_id: string
          created_at?: string
          created_by?: string | null
          etapa_kanban?: string | null
          id?: string
          pagamento_id: string
          pausada?: boolean
          pausada_motivo?: string | null
          prioridade?: string | null
          prioridade_justificativa?: string | null
          promessa_data?: string | null
          promessas_quebradas?: number | null
          responsavel_id?: string | null
          saldo: number
          status?: Database["public"]["Enums"]["cobranca_status"]
          tentativas?: number
          ultima_cobranca_em?: string | null
          ultima_resposta_em?: string | null
          updated_at?: string
          updated_by?: string | null
          valor_original: number
          valor_pago?: number
          vencimento: string
          version?: number
        }
        Update: {
          arquivada_em?: string | null
          arquivada_motivo?: string | null
          arquivada_por?: string | null
          atendimento_id?: string | null
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          etapa_kanban?: string | null
          id?: string
          pagamento_id?: string
          pausada?: boolean
          pausada_motivo?: string | null
          prioridade?: string | null
          prioridade_justificativa?: string | null
          promessa_data?: string | null
          promessas_quebradas?: number | null
          responsavel_id?: string | null
          saldo?: number
          status?: Database["public"]["Enums"]["cobranca_status"]
          tentativas?: number
          ultima_cobranca_em?: string | null
          ultima_resposta_em?: string | null
          updated_at?: string
          updated_by?: string | null
          valor_original?: number
          valor_pago?: number
          vencimento?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "cobrancas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "cobrancas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "cobrancas_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: true
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas_config: {
        Row: {
          horario_envio: string
          id: string
          modo: Database["public"]["Enums"]["cobranca_modo"]
          nao_repetir_no_dia: boolean
          pix_chave: string | null
          pix_tipo: string | null
          singleton: boolean
          updated_at: string
        }
        Insert: {
          horario_envio?: string
          id?: string
          modo?: Database["public"]["Enums"]["cobranca_modo"]
          nao_repetir_no_dia?: boolean
          pix_chave?: string | null
          pix_tipo?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          horario_envio?: string
          id?: string
          modo?: Database["public"]["Enums"]["cobranca_modo"]
          nao_repetir_no_dia?: boolean
          pix_chave?: string | null
          pix_tipo?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      cobrancas_eventos: {
        Row: {
          canal: string | null
          cobranca_id: string
          created_at: string
          id: string
          payload: Json
          tipo: Database["public"]["Enums"]["cobranca_evento_tipo"]
          usuario_email: string | null
          usuario_id: string | null
        }
        Insert: {
          canal?: string | null
          cobranca_id: string
          created_at?: string
          id?: string
          payload?: Json
          tipo: Database["public"]["Enums"]["cobranca_evento_tipo"]
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Update: {
          canal?: string | null
          cobranca_id?: string
          created_at?: string
          id?: string
          payload?: Json
          tipo?: Database["public"]["Enums"]["cobranca_evento_tipo"]
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_eventos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas_templates: {
        Row: {
          ativo: boolean
          corpo: string
          created_at: string
          gatilho: Database["public"]["Enums"]["cobranca_gatilho"]
          id: string
          ordem: number
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          corpo: string
          created_at?: string
          gatilho: Database["public"]["Enums"]["cobranca_gatilho"]
          id?: string
          ordem?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          corpo?: string
          created_at?: string
          gatilho?: Database["public"]["Enums"]["cobranca_gatilho"]
          id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      compras: {
        Row: {
          anexo_url: string | null
          arquivado_em: string | null
          arquivado_motivo: string | null
          arquivado_por: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          created_at: string
          data_compra: string
          data_recebimento: string | null
          descricao: string | null
          forma_pagamento: Database["public"]["Enums"]["pagamento_forma"]
          fornecedor_id: string
          id: string
          is_teste: boolean
          numero_documento: string | null
          observacoes: string | null
          parcelas: number
          primeiro_vencimento: string | null
          recebido: boolean
          responsavel_id: string | null
          updated_at: string
          valor_total: number
        }
        Insert: {
          anexo_url?: string | null
          arquivado_em?: string | null
          arquivado_motivo?: string | null
          arquivado_por?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          created_at?: string
          data_compra?: string
          data_recebimento?: string | null
          descricao?: string | null
          forma_pagamento?: Database["public"]["Enums"]["pagamento_forma"]
          fornecedor_id: string
          id?: string
          is_teste?: boolean
          numero_documento?: string | null
          observacoes?: string | null
          parcelas?: number
          primeiro_vencimento?: string | null
          recebido?: boolean
          responsavel_id?: string | null
          updated_at?: string
          valor_total: number
        }
        Update: {
          anexo_url?: string | null
          arquivado_em?: string | null
          arquivado_motivo?: string | null
          arquivado_por?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          created_at?: string
          data_compra?: string
          data_recebimento?: string | null
          descricao?: string | null
          forma_pagamento?: Database["public"]["Enums"]["pagamento_forma"]
          fornecedor_id?: string
          id?: string
          is_teste?: boolean
          numero_documento?: string | null
          observacoes?: string | null
          parcelas?: number
          primeiro_vencimento?: string | null
          recebido?: boolean
          responsavel_id?: string | null
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
          arquivado_em: string | null
          arquivado_motivo: string | null
          arquivado_por: string | null
          compra_id: string
          comprovante_url: string | null
          created_at: string
          data_pagamento: string | null
          desconto: number | null
          forma_pagamento: Database["public"]["Enums"]["pagamento_forma"] | null
          id: string
          is_teste: boolean
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
          arquivado_em?: string | null
          arquivado_motivo?: string | null
          arquivado_por?: string | null
          compra_id: string
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          desconto?: number | null
          forma_pagamento?:
            | Database["public"]["Enums"]["pagamento_forma"]
            | null
          id?: string
          is_teste?: boolean
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
          arquivado_em?: string | null
          arquivado_motivo?: string | null
          arquivado_por?: string | null
          compra_id?: string
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          desconto?: number | null
          forma_pagamento?:
            | Database["public"]["Enums"]["pagamento_forma"]
            | null
          id?: string
          is_teste?: boolean
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
      conciliacao_logs: {
        Row: {
          created_at: string | null
          data_execucao: string | null
          detalhes: Json | null
          executado_por: string | null
          id: string
          resumo: Json | null
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string | null
          data_execucao?: string | null
          detalhes?: Json | null
          executado_por?: string | null
          id?: string
          resumo?: Json | null
          status: string
          tipo: string
        }
        Update: {
          created_at?: string | null
          data_execucao?: string | null
          detalhes?: Json | null
          executado_por?: string | null
          id?: string
          resumo?: Json | null
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      conversas_estado: {
        Row: {
          cliente_id: string
          created_at: string
          resolvida_em: string | null
          resolvida_por: string | null
          responsavel_atribuido_em: string | null
          responsavel_atribuido_por: string | null
          responsavel_id: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          resolvida_em?: string | null
          resolvida_por?: string | null
          responsavel_atribuido_em?: string | null
          responsavel_atribuido_por?: string | null
          responsavel_id?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          resolvida_em?: string | null
          resolvida_por?: string | null
          responsavel_atribuido_em?: string | null
          responsavel_atribuido_por?: string | null
          responsavel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversas_estado_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_estado_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "mensagens_threads"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "conversas_estado_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "conversas_estado_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "pets_reativacao"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      datas_comemorativas: {
        Row: {
          ativo: boolean
          created_at: string
          dia: number
          id: string
          mes: number
          nome: string
          template: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia: number
          id?: string
          mes: number
          nome: string
          template: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia?: number
          id?: string
          mes?: number
          nome?: string
          template?: string
          updated_at?: string
        }
        Relationships: []
      }
      empresa_config: {
        Row: {
          cnpj: string | null
          email: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          nome_fantasia: string
          pix_chave: string | null
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
          pix_chave?: string | null
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
          pix_chave?: string | null
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
      ia_auditoria: {
        Row: {
          comando_original: string
          created_at: string | null
          dados_extraidos: Json | null
          erro: string | null
          ferramentas_chamadas: Json | null
          id: string
          intencao_identificada: string | null
          metadados: Json | null
          status: string | null
          tempo_resposta_ms: number | null
          transcricao: string | null
          usuario_id: string | null
        }
        Insert: {
          comando_original: string
          created_at?: string | null
          dados_extraidos?: Json | null
          erro?: string | null
          ferramentas_chamadas?: Json | null
          id?: string
          intencao_identificada?: string | null
          metadados?: Json | null
          status?: string | null
          tempo_resposta_ms?: number | null
          transcricao?: string | null
          usuario_id?: string | null
        }
        Update: {
          comando_original?: string
          created_at?: string | null
          dados_extraidos?: Json | null
          erro?: string | null
          ferramentas_chamadas?: Json | null
          id?: string
          intencao_identificada?: string | null
          metadados?: Json | null
          status?: string | null
          tempo_resposta_ms?: number | null
          transcricao?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      ia_config: {
        Row: {
          assinatura: string
          created_at: string
          criatividade: number
          horario_fim: string
          horario_inicio: string
          ia_ativa: boolean
          id: string
          instrucoes_empresa: string
          intervalo_min_horas: number
          limite_caracteres: number
          link_pagamento: string | null
          max_tentativas_contato: number
          max_tentativas_ia: number
          modelo_alternativo: string
          modelo_principal: string
          palavras_proibidas: string[]
          permitir_mencao_juridica: boolean
          pix_chave: string | null
          provedor: string
          singleton: boolean
          timeout_ms: number
          updated_at: string
        }
        Insert: {
          assinatura?: string
          created_at?: string
          criatividade?: number
          horario_fim?: string
          horario_inicio?: string
          ia_ativa?: boolean
          id?: string
          instrucoes_empresa?: string
          intervalo_min_horas?: number
          limite_caracteres?: number
          link_pagamento?: string | null
          max_tentativas_contato?: number
          max_tentativas_ia?: number
          modelo_alternativo?: string
          modelo_principal?: string
          palavras_proibidas?: string[]
          permitir_mencao_juridica?: boolean
          pix_chave?: string | null
          provedor?: string
          singleton?: boolean
          timeout_ms?: number
          updated_at?: string
        }
        Update: {
          assinatura?: string
          created_at?: string
          criatividade?: number
          horario_fim?: string
          horario_inicio?: string
          ia_ativa?: boolean
          id?: string
          instrucoes_empresa?: string
          intervalo_min_horas?: number
          limite_caracteres?: number
          link_pagamento?: string | null
          max_tentativas_contato?: number
          max_tentativas_ia?: number
          modelo_alternativo?: string
          modelo_principal?: string
          palavras_proibidas?: string[]
          permitir_mencao_juridica?: boolean
          pix_chave?: string | null
          provedor?: string
          singleton?: boolean
          timeout_ms?: number
          updated_at?: string
        }
        Relationships: []
      }
      ia_metricas: {
        Row: {
          codigo_erro: string | null
          created_at: string
          duracao_ms: number | null
          id: string
          modelo: string | null
          origem: string
          sucesso: boolean
          tokens: number | null
          user_id: string | null
          usou_fallback: boolean
        }
        Insert: {
          codigo_erro?: string | null
          created_at?: string
          duracao_ms?: number | null
          id?: string
          modelo?: string | null
          origem: string
          sucesso?: boolean
          tokens?: number | null
          user_id?: string | null
          usou_fallback?: boolean
        }
        Update: {
          codigo_erro?: string | null
          created_at?: string
          duracao_ms?: number | null
          id?: string
          modelo?: string | null
          origem?: string
          sucesso?: boolean
          tokens?: number | null
          user_id?: string | null
          usou_fallback?: boolean
        }
        Relationships: []
      }
      ia_regras_tom: {
        Row: {
          ativo: boolean
          bloquear_ia: boolean
          condicao: string
          created_at: string
          dias_max: number | null
          dias_min: number | null
          id: string
          nivel_firmeza: number
          nome: string
          observacao: string | null
          ordem: number
          requer_revisao_humana: boolean
          tom: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bloquear_ia?: boolean
          condicao: string
          created_at?: string
          dias_max?: number | null
          dias_min?: number | null
          id?: string
          nivel_firmeza?: number
          nome: string
          observacao?: string | null
          ordem?: number
          requer_revisao_humana?: boolean
          tom: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bloquear_ia?: boolean
          condicao?: string
          created_at?: string
          dias_max?: number | null
          dias_min?: number | null
          id?: string
          nivel_firmeza?: number
          nome?: string
          observacao?: string | null
          ordem?: number
          requer_revisao_humana?: boolean
          tom?: string
          updated_at?: string
        }
        Relationships: []
      }
      lembretes_config: {
        Row: {
          aniversario_hora: string
          aniversario_pet_ativo: boolean
          aniversario_template: string
          aniversario_tutor_ativo: boolean
          aniversario_tutor_template: string
          created_at: string
          datas_especiais_ativo: boolean
          id: string
          lembrete_24h_ativo: boolean
          lembrete_24h_hora: string
          lembrete_24h_template: string
          petversario_ativo: boolean
          petversario_template: string
          pos_atendimento_ativo: boolean
          pos_atendimento_horas: number
          pos_atendimento_template: string
          sugestao_confirmacao_horas: number
          sugestao_pos_atendimento_horas: number
          sugestao_reengajamento_dias: number
          updated_at: string
        }
        Insert: {
          aniversario_hora?: string
          aniversario_pet_ativo?: boolean
          aniversario_template?: string
          aniversario_tutor_ativo?: boolean
          aniversario_tutor_template?: string
          created_at?: string
          datas_especiais_ativo?: boolean
          id?: string
          lembrete_24h_ativo?: boolean
          lembrete_24h_hora?: string
          lembrete_24h_template?: string
          petversario_ativo?: boolean
          petversario_template?: string
          pos_atendimento_ativo?: boolean
          pos_atendimento_horas?: number
          pos_atendimento_template?: string
          sugestao_confirmacao_horas?: number
          sugestao_pos_atendimento_horas?: number
          sugestao_reengajamento_dias?: number
          updated_at?: string
        }
        Update: {
          aniversario_hora?: string
          aniversario_pet_ativo?: boolean
          aniversario_template?: string
          aniversario_tutor_ativo?: boolean
          aniversario_tutor_template?: string
          created_at?: string
          datas_especiais_ativo?: boolean
          id?: string
          lembrete_24h_ativo?: boolean
          lembrete_24h_hora?: string
          lembrete_24h_template?: string
          petversario_ativo?: boolean
          petversario_template?: string
          pos_atendimento_ativo?: boolean
          pos_atendimento_horas?: number
          pos_atendimento_template?: string
          sugestao_confirmacao_horas?: number
          sugestao_pos_atendimento_horas?: number
          sugestao_reengajamento_dias?: number
          updated_at?: string
        }
        Relationships: []
      }
      lembretes_fila: {
        Row: {
          agendamento_id: string | null
          atendimento_id: string | null
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          enviado_em: string | null
          enviado_por: string | null
          erro: string | null
          id: string
          idempotency_key: string
          max_tentativas: number
          mensagem: string
          pet_id: string | null
          pet_nome: string | null
          proximo_envio: string
          status: string
          telefone: string | null
          tentativas: number
          tipo: string
          ultima_tentativa: string | null
          updated_at: string
        }
        Insert: {
          agendamento_id?: string | null
          atendimento_id?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          enviado_em?: string | null
          enviado_por?: string | null
          erro?: string | null
          id?: string
          idempotency_key: string
          max_tentativas?: number
          mensagem: string
          pet_id?: string | null
          pet_nome?: string | null
          proximo_envio?: string
          status?: string
          telefone?: string | null
          tentativas?: number
          tipo: string
          ultima_tentativa?: string | null
          updated_at?: string
        }
        Update: {
          agendamento_id?: string | null
          atendimento_id?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          enviado_em?: string | null
          enviado_por?: string | null
          erro?: string | null
          id?: string
          idempotency_key?: string
          max_tentativas?: number
          mensagem?: string
          pet_id?: string | null
          pet_nome?: string | null
          proximo_envio?: string
          status?: string
          telefone?: string | null
          tentativas?: number
          tipo?: string
          ultima_tentativa?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lembretes_fila_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lembretes_fila_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["proximo_agendamento_id"]
          },
          {
            foreignKeyName: "lembretes_fila_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lembretes_fila_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lembretes_fila_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "lembretes_fila_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "lembretes_fila_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "lembretes_fila_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lembretes_fila_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["pet_id"]
          },
        ]
      }
      leva_traz_eventos: {
        Row: {
          agendamento_id: string | null
          created_at: string
          id: string
          payload: Json | null
          tarefa_id: string | null
          tipo: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          agendamento_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          tarefa_id?: string | null
          tipo: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          agendamento_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          tarefa_id?: string | null
          tipo?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leva_traz_eventos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leva_traz_eventos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["proximo_agendamento_id"]
          },
          {
            foreignKeyName: "leva_traz_eventos_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "leva_traz_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      leva_traz_tarefas: {
        Row: {
          agendamento_id: string
          alergias_snapshot: string | null
          cliente_id: string
          created_at: string
          created_by: string | null
          data: string
          endereco: Json
          hora_prevista: string
          id: string
          observacoes: string | null
          pet_id: string
          responsavel_id: string | null
          status: Database["public"]["Enums"]["leva_traz_status"]
          telefone: string | null
          temperamento_snapshot: string | null
          tipo: Database["public"]["Enums"]["leva_traz_tipo"]
          updated_at: string
          updated_by: string | null
          valor_rateado: number
          version: number
        }
        Insert: {
          agendamento_id: string
          alergias_snapshot?: string | null
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data: string
          endereco: Json
          hora_prevista: string
          id?: string
          observacoes?: string | null
          pet_id: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["leva_traz_status"]
          telefone?: string | null
          temperamento_snapshot?: string | null
          tipo: Database["public"]["Enums"]["leva_traz_tipo"]
          updated_at?: string
          updated_by?: string | null
          valor_rateado?: number
          version?: number
        }
        Update: {
          agendamento_id?: string
          alergias_snapshot?: string | null
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data?: string
          endereco?: Json
          hora_prevista?: string
          id?: string
          observacoes?: string | null
          pet_id?: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["leva_traz_status"]
          telefone?: string | null
          temperamento_snapshot?: string | null
          tipo?: Database["public"]["Enums"]["leva_traz_tipo"]
          updated_at?: string
          updated_by?: string | null
          valor_rateado?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "leva_traz_tarefas_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leva_traz_tarefas_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["proximo_agendamento_id"]
          },
          {
            foreignKeyName: "leva_traz_tarefas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leva_traz_tarefas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "leva_traz_tarefas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "leva_traz_tarefas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "leva_traz_tarefas_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leva_traz_tarefas_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["pet_id"]
          },
        ]
      }
      mensagem_sugestoes: {
        Row: {
          adiada_para: string | null
          agendamento_id: string | null
          atendimento_id: string | null
          canal: string
          cliente_id: string | null
          cobranca_id: string | null
          created_at: string
          dias_atraso: number | null
          feedback: string | null
          feedback_em: string | null
          feedback_por: string | null
          id: string
          idempotency_key: string | null
          mensagem_sugerida: string | null
          motivo: string
          motivo_do_tom: string | null
          pet_id: string | null
          prazo_proxima_acao_horas: number | null
          prevista_para: string | null
          prioridade: number
          prioridade_label: string | null
          proxima_acao: string | null
          status: string
          tipo: string
          tom_sugerido: string | null
          updated_at: string
          valor_pendente: number | null
        }
        Insert: {
          adiada_para?: string | null
          agendamento_id?: string | null
          atendimento_id?: string | null
          canal?: string
          cliente_id?: string | null
          cobranca_id?: string | null
          created_at?: string
          dias_atraso?: number | null
          feedback?: string | null
          feedback_em?: string | null
          feedback_por?: string | null
          id?: string
          idempotency_key?: string | null
          mensagem_sugerida?: string | null
          motivo: string
          motivo_do_tom?: string | null
          pet_id?: string | null
          prazo_proxima_acao_horas?: number | null
          prevista_para?: string | null
          prioridade?: number
          prioridade_label?: string | null
          proxima_acao?: string | null
          status?: string
          tipo: string
          tom_sugerido?: string | null
          updated_at?: string
          valor_pendente?: number | null
        }
        Update: {
          adiada_para?: string | null
          agendamento_id?: string | null
          atendimento_id?: string | null
          canal?: string
          cliente_id?: string | null
          cobranca_id?: string | null
          created_at?: string
          dias_atraso?: number | null
          feedback?: string | null
          feedback_em?: string | null
          feedback_por?: string | null
          id?: string
          idempotency_key?: string | null
          mensagem_sugerida?: string | null
          motivo?: string
          motivo_do_tom?: string | null
          pet_id?: string | null
          prazo_proxima_acao_horas?: number | null
          prevista_para?: string | null
          prioridade?: number
          prioridade_label?: string | null
          proxima_acao?: string | null
          status?: string
          tipo?: string
          tom_sugerido?: string | null
          updated_at?: string
          valor_pendente?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagem_sugestoes_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagem_sugestoes_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["proximo_agendamento_id"]
          },
          {
            foreignKeyName: "mensagem_sugestoes_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagem_sugestoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagem_sugestoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "mensagem_sugestoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "mensagem_sugestoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "mensagem_sugestoes_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagem_sugestoes_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagem_sugestoes_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["pet_id"]
          },
        ]
      }
      mensagem_templates: {
        Row: {
          ativo: boolean
          corpo: string
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          is_padrao: boolean
          nome: string
          tipo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          corpo: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_padrao?: boolean
          nome: string
          tipo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          corpo?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_padrao?: boolean
          nome?: string
          tipo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      mensagens: {
        Row: {
          agendada_para: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          atendimento_id: string | null
          autor_email: string | null
          autor_id: string | null
          canal: string
          cliente_id: string
          cobranca_id: string | null
          contexto_ia: Json | null
          corpo: string
          created_at: string
          direcao: string
          enviado_em: string | null
          erro_ia: string | null
          id: string
          lida_em: string | null
          mensagem_ia_original: string | null
          mensagem_original: string | null
          metadata: Json
          modelo_ia: string | null
          nivel_firmeza: number | null
          pagamento_id: string | null
          promessa_id: string | null
          resultado_contato: string | null
          status: string
          sugestao_id: string | null
          tags: Json
          template_id: string | null
          tempo_geracao_ms: number | null
          texto_editado: string | null
          tipo: string | null
          tokens_estimados: number | null
          tom_escolhido: string | null
          tom_sugerido: string | null
        }
        Insert: {
          agendada_para?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          atendimento_id?: string | null
          autor_email?: string | null
          autor_id?: string | null
          canal?: string
          cliente_id: string
          cobranca_id?: string | null
          contexto_ia?: Json | null
          corpo: string
          created_at?: string
          direcao: string
          enviado_em?: string | null
          erro_ia?: string | null
          id?: string
          lida_em?: string | null
          mensagem_ia_original?: string | null
          mensagem_original?: string | null
          metadata?: Json
          modelo_ia?: string | null
          nivel_firmeza?: number | null
          pagamento_id?: string | null
          promessa_id?: string | null
          resultado_contato?: string | null
          status?: string
          sugestao_id?: string | null
          tags?: Json
          template_id?: string | null
          tempo_geracao_ms?: number | null
          texto_editado?: string | null
          tipo?: string | null
          tokens_estimados?: number | null
          tom_escolhido?: string | null
          tom_sugerido?: string | null
        }
        Update: {
          agendada_para?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          atendimento_id?: string | null
          autor_email?: string | null
          autor_id?: string | null
          canal?: string
          cliente_id?: string
          cobranca_id?: string | null
          contexto_ia?: Json | null
          corpo?: string
          created_at?: string
          direcao?: string
          enviado_em?: string | null
          erro_ia?: string | null
          id?: string
          lida_em?: string | null
          mensagem_ia_original?: string | null
          mensagem_original?: string | null
          metadata?: Json
          modelo_ia?: string | null
          nivel_firmeza?: number | null
          pagamento_id?: string | null
          promessa_id?: string | null
          resultado_contato?: string | null
          status?: string
          sugestao_id?: string | null
          tags?: Json
          template_id?: string | null
          tempo_geracao_ms?: number | null
          texto_editado?: string | null
          tipo?: string | null
          tokens_estimados?: number | null
          tom_escolhido?: string | null
          tom_sugerido?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "mensagens_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "mensagens_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "mensagens_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_promessa_id_fkey"
            columns: ["promessa_id"]
            isOneToOne: false
            referencedRelation: "promessas_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_sugestao_id_fkey"
            columns: ["sugestao_id"]
            isOneToOne: false
            referencedRelation: "mensagem_sugestoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "mensagem_templates"
            referencedColumns: ["id"]
          },
        ]
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
      notificacoes: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string | null
          lida: boolean
          link: string | null
          mensagem: string | null
          payload: Json | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key?: string | null
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          payload?: Json | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string | null
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          payload?: Json | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
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
            foreignKeyName: "ocorrencias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ocorrencias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ocorrencias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ocorrencias_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["pet_id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          arquivado_em: string | null
          arquivado_motivo: string | null
          arquivado_por: string | null
          atendimento_id: string | null
          categoria_receita: string | null
          cliente_id: string | null
          comprovante_path: string | null
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          descricao: string | null
          forma: Database["public"]["Enums"]["pagamento_forma"]
          ia_analisado: boolean | null
          ia_meta_dados: Json | null
          id: string
          id_transacao_bancaria: string | null
          is_teste: boolean
          observacoes: string | null
          responsavel_id: string | null
          status: Database["public"]["Enums"]["pagamento_status"]
          updated_at: string
          updated_by: string | null
          valor_pago: number
          valor_total: number
          vencimento: string | null
          version: number
        }
        Insert: {
          arquivado_em?: string | null
          arquivado_motivo?: string | null
          arquivado_por?: string | null
          atendimento_id?: string | null
          categoria_receita?: string | null
          cliente_id?: string | null
          comprovante_path?: string | null
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          forma?: Database["public"]["Enums"]["pagamento_forma"]
          ia_analisado?: boolean | null
          ia_meta_dados?: Json | null
          id?: string
          id_transacao_bancaria?: string | null
          is_teste?: boolean
          observacoes?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["pagamento_status"]
          updated_at?: string
          updated_by?: string | null
          valor_pago?: number
          valor_total: number
          vencimento?: string | null
          version?: number
        }
        Update: {
          arquivado_em?: string | null
          arquivado_motivo?: string | null
          arquivado_por?: string | null
          atendimento_id?: string | null
          categoria_receita?: string | null
          cliente_id?: string | null
          comprovante_path?: string | null
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          forma?: Database["public"]["Enums"]["pagamento_forma"]
          ia_analisado?: boolean | null
          ia_meta_dados?: Json | null
          id?: string
          id_transacao_bancaria?: string | null
          is_teste?: boolean
          observacoes?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["pagamento_status"]
          updated_at?: string
          updated_by?: string | null
          valor_pago?: number
          valor_total?: number
          vencimento?: string | null
          version?: number
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
          {
            foreignKeyName: "pagamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "pagamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "pagamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      pet_acessos_log: {
        Row: {
          acao: string
          created_at: string
          escopo: Json
          id: string
          pet_id: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          escopo?: Json
          id?: string
          pet_id: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          escopo?: Json
          id?: string
          pet_id?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_acessos_log_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_acessos_log_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["pet_id"]
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
          created_by: string | null
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
          updated_by: string | null
          version: number
        }
        Insert: {
          alergias?: string | null
          ativo?: boolean
          castrado?: boolean | null
          cliente_id: string
          cor?: string | null
          created_at?: string
          created_by?: string | null
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
          updated_by?: string | null
          version?: number
        }
        Update: {
          alergias?: string | null
          ativo?: boolean
          castrado?: boolean | null
          cliente_id?: string
          cor?: string | null
          created_at?: string
          created_by?: string | null
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
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "pets_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pets_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "pets_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "pets_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["cliente_id"]
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
          avatar_url: string | null
          bloqueado_em: string | null
          convidado_por: string | null
          created_at: string
          desativado_em: string | null
          email: string | null
          id: string
          nome: string
          observacoes_admin: string | null
          perfil: string
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bloqueado_em?: string | null
          convidado_por?: string | null
          created_at?: string
          desativado_em?: string | null
          email?: string | null
          id: string
          nome: string
          observacoes_admin?: string | null
          perfil?: string
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bloqueado_em?: string | null
          convidado_por?: string | null
          created_at?: string
          desativado_em?: string | null
          email?: string | null
          id?: string
          nome?: string
          observacoes_admin?: string | null
          perfil?: string
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promessas_pagamento: {
        Row: {
          cliente_id: string
          cobranca_id: string | null
          created_at: string
          data_prometida: string
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          registrado_por: string | null
          registrado_por_email: string | null
          resolvida_em: string | null
          status: string
          updated_at: string
          valor_prometido: number
          valor_recebido: number
        }
        Insert: {
          cliente_id: string
          cobranca_id?: string | null
          created_at?: string
          data_prometida: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          registrado_por?: string | null
          registrado_por_email?: string | null
          resolvida_em?: string | null
          status?: string
          updated_at?: string
          valor_prometido?: number
          valor_recebido?: number
        }
        Update: {
          cliente_id?: string
          cobranca_id?: string | null
          created_at?: string
          data_prometida?: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          registrado_por?: string | null
          registrado_por_email?: string | null
          resolvida_em?: string | null
          status?: string
          updated_at?: string
          valor_prometido?: number
          valor_recebido?: number
        }
        Relationships: [
          {
            foreignKeyName: "promessas_pagamento_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promessas_pagamento_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "promessas_pagamento_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "promessas_pagamento_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "promessas_pagamento_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
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
          cancelado: boolean
          codigo_publico: string | null
          contraparte: string | null
          created_at: string
          data_atendimento: string | null
          data_pagamento: string | null
          enviado_em: string
          enviado_por: string | null
          forma_pagamento: string | null
          id: string
          mensagem: string | null
          numero_recibo: string
          pet_nome: string | null
          referencia_id: string
          servico: string | null
          signed_url: string | null
          storage_path: string | null
          telefone: string | null
          tipo: string
          valor: number
        }
        Insert: {
          cancelado?: boolean
          codigo_publico?: string | null
          contraparte?: string | null
          created_at?: string
          data_atendimento?: string | null
          data_pagamento?: string | null
          enviado_em?: string
          enviado_por?: string | null
          forma_pagamento?: string | null
          id?: string
          mensagem?: string | null
          numero_recibo: string
          pet_nome?: string | null
          referencia_id: string
          servico?: string | null
          signed_url?: string | null
          storage_path?: string | null
          telefone?: string | null
          tipo: string
          valor: number
        }
        Update: {
          cancelado?: boolean
          codigo_publico?: string | null
          contraparte?: string | null
          created_at?: string
          data_atendimento?: string | null
          data_pagamento?: string | null
          enviado_em?: string
          enviado_por?: string | null
          forma_pagamento?: string | null
          id?: string
          mensagem?: string | null
          numero_recibo?: string
          pet_nome?: string | null
          referencia_id?: string
          servico?: string | null
          signed_url?: string | null
          storage_path?: string | null
          telefone?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: []
      }
      relatorios_agendamentos: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          destinatarios: Json
          hora_envio: string
          id: string
          kpis: Json
          nome: string
          rodape_mensagem: string | null
          titulo_mensagem: string | null
          ultima_execucao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          destinatarios?: Json
          hora_envio?: string
          id?: string
          kpis?: Json
          nome: string
          rodape_mensagem?: string | null
          titulo_mensagem?: string | null
          ultima_execucao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          destinatarios?: Json
          hora_envio?: string
          id?: string
          kpis?: Json
          nome?: string
          rodape_mensagem?: string | null
          titulo_mensagem?: string | null
          ultima_execucao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      relatorios_execucoes: {
        Row: {
          agendamento_id: string | null
          agendamento_nome: string
          created_at: string
          destinatario_nome: string
          destinatario_whatsapp: string
          enviado_em: string | null
          enviado_por: string | null
          gerado_em: string
          id: string
          mensagem: string
          observacao: string | null
          periodo_ate: string
          periodo_de: string
          wa_url: string
        }
        Insert: {
          agendamento_id?: string | null
          agendamento_nome: string
          created_at?: string
          destinatario_nome: string
          destinatario_whatsapp: string
          enviado_em?: string | null
          enviado_por?: string | null
          gerado_em?: string
          id?: string
          mensagem: string
          observacao?: string | null
          periodo_ate: string
          periodo_de: string
          wa_url: string
        }
        Update: {
          agendamento_id?: string | null
          agendamento_nome?: string
          created_at?: string
          destinatario_nome?: string
          destinatario_whatsapp?: string
          enviado_em?: string | null
          enviado_por?: string | null
          gerado_em?: string
          id?: string
          mensagem?: string
          observacao?: string | null
          periodo_ate?: string
          periodo_de?: string
          wa_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_execucoes_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "relatorios_agendamentos"
            referencedColumns: ["id"]
          },
        ]
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
          preco_a_partir: boolean
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
          preco_a_partir?: boolean
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
          preco_a_partir?: boolean
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
      user_invites: {
        Row: {
          aceito_em: string | null
          aceito_por: string | null
          cancelado_em: string | null
          criado_em: string
          criado_por: string | null
          email: string
          expira_em: string | null
          id: string
          mensagem: string | null
          nome: string | null
          perfil: string
          permissoes: Json | null
          status: string
          telefone: string | null
        }
        Insert: {
          aceito_em?: string | null
          aceito_por?: string | null
          cancelado_em?: string | null
          criado_em?: string
          criado_por?: string | null
          email: string
          expira_em?: string | null
          id?: string
          mensagem?: string | null
          nome?: string | null
          perfil: string
          permissoes?: Json | null
          status?: string
          telefone?: string | null
        }
        Update: {
          aceito_em?: string | null
          aceito_por?: string | null
          cancelado_em?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string
          expira_em?: string | null
          id?: string
          mensagem?: string | null
          nome?: string | null
          perfil?: string
          permissoes?: Json | null
          status?: string
          telefone?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          acao: string
          concedido_em: string
          concedido_por: string | null
          modulo: string
          permitido: boolean
          user_id: string
        }
        Insert: {
          acao: string
          concedido_em?: string
          concedido_por?: string | null
          modulo: string
          permitido?: boolean
          user_id: string
        }
        Update: {
          acao?: string
          concedido_em?: string
          concedido_por?: string | null
          modulo?: string
          permitido?: boolean
          user_id?: string
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
      whatsapp_contatos: {
        Row: {
          atendimento_id: string | null
          cliente_id: string | null
          cobranca_id: string | null
          created_at: string
          destinatario: string
          id: string
          marcado_em: string | null
          mensagem: string
          motivo: string | null
          observacao: string | null
          pagamento_id: string | null
          status: string
          telefone: string
          tipo: string
          user_id: string | null
        }
        Insert: {
          atendimento_id?: string | null
          cliente_id?: string | null
          cobranca_id?: string | null
          created_at?: string
          destinatario: string
          id?: string
          marcado_em?: string | null
          mensagem: string
          motivo?: string | null
          observacao?: string | null
          pagamento_id?: string | null
          status?: string
          telefone: string
          tipo: string
          user_id?: string | null
        }
        Update: {
          atendimento_id?: string | null
          cliente_id?: string | null
          cobranca_id?: string | null
          created_at?: string
          destinatario?: string
          id?: string
          marcado_em?: string | null
          mensagem?: string
          motivo?: string | null
          observacao?: string | null
          pagamento_id?: string | null
          status?: string
          telefone?: string
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contatos_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_contatos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_contatos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "whatsapp_contatos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "mensagens_threads_v2"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "whatsapp_contatos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "pets_reativacao"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "whatsapp_contatos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_contatos_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mensagens_threads: {
        Row: {
          cliente_id: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          nao_lidas: number | null
          total_mensagens: number | null
          ultima_direcao: string | null
          ultima_em: string | null
          ultima_mensagem: string | null
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          nao_lidas?: never
          total_mensagens?: never
          ultima_direcao?: never
          ultima_em?: never
          ultima_mensagem?: never
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          nao_lidas?: never
          total_mensagens?: never
          ultima_direcao?: never
          ultima_em?: never
          ultima_mensagem?: never
        }
        Relationships: []
      }
      mensagens_threads_v2: {
        Row: {
          cliente_id: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          cliente_whatsapp: string | null
          nao_lidas: number | null
          pet_primeiro_nome: string | null
          proximo_agendamento_data: string | null
          proximo_agendamento_hora: string | null
          proximo_agendamento_id: string | null
          resolvida_em: string | null
          responsavel_avatar: string | null
          responsavel_email: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          status_conversa: string | null
          total_mensagens: number | null
          ultima_direcao: string | null
          ultima_em: string | null
          ultima_em_in: string | null
          ultima_mensagem: string | null
        }
        Relationships: []
      }
      pets_reativacao: {
        Row: {
          cliente_id: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          cliente_whatsapp: string | null
          dias_inativo: number | null
          faixa: string | null
          pet_foto: string | null
          pet_id: string | null
          pet_nome: string | null
          retornou_apos_contato: boolean | null
          ticket_medio: number | null
          total_atendimentos: number | null
          ultimo_atendimento_em: string | null
          ultimo_contato_reativacao_em: string | null
        }
        Relationships: []
      }
      vw_financeiro_indicadores: {
        Row: {
          data_referencia: string | null
          quantidade_atendimentos: number | null
          tipo: string | null
          valor: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      atualizar_agendamento_seguro: {
        Args: { _id: string; _payload: Json; _version: number }
        Returns: number
      }
      buscar_clientes_inteligente: {
        Args: { max_rows?: number; termo: string }
        Returns: {
          bairro: string
          cpf: string
          email: string
          id: string
          nome: string
          telefone: string
          vip: boolean
          whatsapp: string
        }[]
      }
      claim_lembretes_pendentes: {
        Args: { _limit?: number }
        Returns: {
          agendamento_id: string | null
          atendimento_id: string | null
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          enviado_em: string | null
          enviado_por: string | null
          erro: string | null
          id: string
          idempotency_key: string
          max_tentativas: number
          mensagem: string
          pet_id: string | null
          pet_nome: string | null
          proximo_envio: string
          status: string
          telefone: string | null
          tentativas: number
          tipo: string
          ultima_tentativa: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "lembretes_fila"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      criar_agendamento_seguro: { Args: { _payload: Json }; Returns: string }
      endereco_cliente_jsonb: { Args: { _cliente_id: string }; Returns: Json }
      enfileirar_lembretes: { Args: never; Returns: Json }
      excluir_atendimento: {
        Args: { _atendimento_id: string }
        Returns: undefined
      }
      gerar_parcelas_compra: {
        Args: { _compra_id: string }
        Returns: undefined
      }
      get_atendimento_total_executado: {
        Args: { atendimento_id: string }
        Returns: number
      }
      get_recibo_publico: {
        Args: { _codigo: string }
        Returns: {
          cancelado: boolean
          codigo: string
          contraparte: string
          data_atendimento: string
          data_pagamento: string
          empresa_logo: string
          empresa_nome: string
          empresa_telefone: string
          empresa_whatsapp: string
          enviado_em: string
          forma_pagamento: string
          numero_recibo: string
          pet_nome: string
          servico: string
          tipo: string
          valor: number
        }[]
      }
      has_permission: {
        Args: { _acao: string; _modulo: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_proprietario: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      limpar_dados_teste_financeiro: { Args: never; Returns: Json }
      pode_gerenciar_usuarios: { Args: { _user_id: string }; Returns: boolean }
      recalcular_agregados: { Args: never; Returns: Json }
      render_lembrete: {
        Args: {
          _data: string
          _hora: string
          _pet: string
          _template: string
          _tutor: string
        }
        Returns: string
      }
      unaccent: { Args: { "": string }; Returns: string }
      verificar_conflito_agendamento: {
        Args: {
          _data: string
          _duracao_min: number
          _hora: string
          _ignorar_id?: string
          _profissional_id: string
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
      app_role: "admin" | "user" | "transportador"
      cobranca_evento_tipo:
        | "criada"
        | "envio_manual"
        | "envio_auto"
        | "resposta"
        | "mudanca_status"
        | "promessa"
        | "pagamento"
        | "pausa"
        | "retomada"
        | "nota"
        | "ia_sugestao"
      cobranca_gatilho:
        | "d_menos_1"
        | "d_zero"
        | "d_mais_3"
        | "d_mais_7"
        | "d_mais_15"
        | "agradecimento"
      cobranca_modo: "manual" | "auto" | "pausado"
      cobranca_status:
        | "a_vencer"
        | "vencido"
        | "enviada"
        | "respondeu"
        | "promessa"
        | "pago_parcial"
        | "pago"
        | "negociado"
        | "sem_retorno"
        | "pausada"
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
      leva_traz_modalidade:
        | "nao_utilizar"
        | "somente_buscar"
        | "somente_entregar"
        | "buscar_entregar"
      leva_traz_status:
        | "aguardando_responsavel"
        | "agendado"
        | "a_caminho_busca"
        | "pet_coletado"
        | "chegou_spa"
        | "aguardando_entrega"
        | "a_caminho_entrega"
        | "pet_entregue"
        | "cancelado"
        | "nao_realizado"
      leva_traz_tipo: "busca" | "entrega"
      ocorrencia_tipo:
        | "machucado"
        | "irritacao"
        | "pulgas_carrapatos"
        | "agressividade"
        | "servico_interrompido"
        | "acidente"
        | "outro"
      pagamento_forma:
        | "pix"
        | "credito"
        | "debito"
        | "dinheiro"
        | "pendente"
        | "outras"
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
      app_role: ["admin", "user", "transportador"],
      cobranca_evento_tipo: [
        "criada",
        "envio_manual",
        "envio_auto",
        "resposta",
        "mudanca_status",
        "promessa",
        "pagamento",
        "pausa",
        "retomada",
        "nota",
        "ia_sugestao",
      ],
      cobranca_gatilho: [
        "d_menos_1",
        "d_zero",
        "d_mais_3",
        "d_mais_7",
        "d_mais_15",
        "agradecimento",
      ],
      cobranca_modo: ["manual", "auto", "pausado"],
      cobranca_status: [
        "a_vencer",
        "vencido",
        "enviada",
        "respondeu",
        "promessa",
        "pago_parcial",
        "pago",
        "negociado",
        "sem_retorno",
        "pausada",
      ],
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
      leva_traz_modalidade: [
        "nao_utilizar",
        "somente_buscar",
        "somente_entregar",
        "buscar_entregar",
      ],
      leva_traz_status: [
        "aguardando_responsavel",
        "agendado",
        "a_caminho_busca",
        "pet_coletado",
        "chegou_spa",
        "aguardando_entrega",
        "a_caminho_entrega",
        "pet_entregue",
        "cancelado",
        "nao_realizado",
      ],
      leva_traz_tipo: ["busca", "entrega"],
      ocorrencia_tipo: [
        "machucado",
        "irritacao",
        "pulgas_carrapatos",
        "agressividade",
        "servico_interrompido",
        "acidente",
        "outro",
      ],
      pagamento_forma: [
        "pix",
        "credito",
        "debito",
        "dinheiro",
        "pendente",
        "outras",
      ],
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
