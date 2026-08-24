# Plan - Implementation of Care Programs (Phase 3)

Integrate Care Programs with Financial, Dashboard, Communication, and AI Assistant modules, ensuring strict separation between Cash and Accrual (Competência) accounting.

## User Review Required

> [!IMPORTANT]
> The user provided a large block of text as a "visual text edit" instructions for Phase 3. I will implement these as the functional requirements for this phase.

- **Partial Payment Strategy**: Should credits be released proportionally, blocked until full payment, or released by manual authorization? (Defaulting to a configurable setting as requested).
- **Accrual Formula**: I will use a proportional allocation based on the original service price to distribute the sold price.

## Proposed Changes

### Financial Integration
- **Contratação**: Create `contas_a_receber` linked to the `programas_contratados`.
- **Pagamento**: Update payments to activate credits based on the selected business rule (partial vs full).
- **Utilização**: Implement accrual recognition (competência) when a service is finalized, without creating new cash entries.
- **Cancelamento**: Logic to calculate utilized/reserved credits and suggest refundable amounts.

### Dashboard & Analytics
- Add specialized KPIs for Care Programs to the main Dashboard and Financial panels:
    - Programs sold, received, and balance due.
    - Active vs expired programs.
    - Credit lifecycle (Available, Reserved, Used).
    - Revenue recognition (Accrual).

### Client & Pet Profile
- New "Programas de Cuidado" section in `PetDetails` and `ClientDetails`.
- History of usage and validity tracking.

### AI Assistant (Phase 3 Tools)
- Implement real tools in `ia-agente.server.ts` and `AssistenteIaSidebar.tsx`:
    - `consultar_creditos`, `consultar_vencimentos`, `vender_programa` (via AI).
    - AI-driven renewal suggestions based on pet frequency.

### Communication
- New WhatsApp templates for Program confirmation, Credit summaries, and Renewal alerts.

## Technical Details
- **Schema Updates**: Add `financeiro_id` to `programas_contratados` if needed for direct linkage.
- **Accrual Table**: Use a ledger or a view to track recognized revenue per service session.
- **AI Tools**: Register new function definitions in the Gemini ReAct flow.

## Verification Plan
- **Automated**: Test credit deduction and revenue recognition consistency.
- **Manual**: Verify that Dashboard totals match individual program reports.
- **AI**: Test voice queries like "How many baths left for Thor?".
