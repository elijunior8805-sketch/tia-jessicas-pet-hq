-- Feature Flags e Configurações para a Assistente Operacional Jessi
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ia_config' AND column_name = 'ai_v2_enabled'
  ) THEN
    ALTER TABLE ia_config 
      ADD COLUMN ai_v2_enabled BOOLEAN DEFAULT true,
      ADD COLUMN ai_v2_queries BOOLEAN DEFAULT true,
      ADD COLUMN ai_v2_scheduling BOOLEAN DEFAULT true,
      ADD COLUMN ai_v2_finance BOOLEAN DEFAULT true,
      ADD COLUMN ai_v2_programs BOOLEAN DEFAULT true,
      ADD COLUMN ai_v2_messages BOOLEAN DEFAULT true,
      ADD COLUMN ai_v2_voice BOOLEAN DEFAULT true,
      ADD COLUMN ai_v2_proactive BOOLEAN DEFAULT true,
      ADD COLUMN ai_v2_payment_reconciliation BOOLEAN DEFAULT true,
      ADD COLUMN ai_v2_model TEXT DEFAULT 'google/gemini-1.5-flash';
  END IF;
END $$;
