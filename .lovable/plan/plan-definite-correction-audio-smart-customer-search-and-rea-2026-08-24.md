# Plan - Definite Correction: Audio, Smart Customer Search, and Real Scheduling

Comprehensive overhaul of the Owner's Assistant (AI) to fix voice scheduling, improve customer search normalization, and ensure reliable database recording.

## Problem Diagnosis
- **Voice Loop**: Recognition events (`onresult`) trigger multiple partial messages.
- **Data Loss**: Closing/Ending recording clears transcript instead of consolidating it.
- **Search Failures**: Literal matching fails for variations like "Eli Júnior" vs "Eli Jr".
- **Broken Flow**: Scheduling intent is interpreted but not executed/verified against the real database.
- **Missing States**: UI lacks clear states for permission, reviewing, and processing.

## Proposed Changes

### 1. Audio Cycle & Voice Recognition (`src/lib/ia/ia-voz.ts` & `useAssistenteActions.ts`)
- **Strict States**: Implement `idle`, `listening`, `finalizing`, `reviewing`, `processing`.
- **Consolidation**: Refactor `VoiceRecognizer` to handle `interim` vs `final` results without duplication.
- **Review Mode**: "Stop recording" triggers a transition to `reviewing` state (showing consolidated transcript in an editable field) instead of immediate execution.
- **Persistence**: Save `editableTranscript` to session storage to prevent loss on re-renders.

### 2. Smart Search & Normalization (`src/lib/ia/ia-consultas.server.ts`)
- **Advanced Normalization**: Implement a robust normalizer for Portuguese (accents, caps, symbols) and specific honorifics/suffixes (Júnior, Jr, etc.).
- **Tiered Search**:
    1. Exact normalized match.
    2. Partial/Token match.
    3. Pet-name association.
    4. Phonetic similarity (fuzzy).
- **Ambiguity Handling**: If 1 candidate -> Confirm. If multiple -> Request selection. If zero -> Suggest registration.

### 3. Real Execution & Verification (`src/lib/ia/ia-acoes.server.ts` & `ia-acoes.functions.ts`)
- **Structured Data**: Ensure `classificarComandoIA` returns a complete structure (Intent, Client ID, Pet ID, Service, Date, Time).
- **Summary & Confirmation**: Mandatory UI step displaying all details before the RPC call.
- **Transaction & Verification**:
    - Backend execution via `criarAgendamentoIA`.
    - Post-creation "Read-back" to confirm the record exists.
    - Return `appointment_id` and formatted confirmation.

### 4. UI Refinement (`src/components/ia/`)
- **IaInputArea**: Update to show current state (recording vs reviewing). Add "Confirm Use" and "Record Again" buttons.
- **IaMessageList**: Prevent fragment messages. Only the final confirmed command appears in history.
- **Error Handling**: Implement Error Boundaries and clear "Try Again" recovery paths.

### 5. Auditing (`src/lib/ia/ia-auditoria.server.ts`)
- **Correlation IDs**: Log every step from `recording_id` to `appointment_id` for forensic tracking.

## Technical Details
- **Tables**: `agendamentos`, `clientes`, `pets`, `servicos`.
- **Logic**: Move complex search logic to server functions to bypass client-side limitations and ensure RLS consistency.
- **Concurrency**: Use `AbortController` and `idempotency_key` to prevent duplicate schedules.

## Verification Plan
1. **Audio Test**: "Agendar banho para Eli Júnior dia 28 às 14h". Verify transcript consolidation and customer identification.
2. **Ambiguity Test**: Search for "Eli" with multiple records. Verify selection list appearance.
3. **Database Test**: Confirm finalization creates exactly one record in `agendamentos` with correct IDs.
4. **Safety Test**: Deny mic permission, check recovery. Close sidebar mid-process, check transcript persistence.
