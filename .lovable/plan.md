# Plan - Phase 2: AI Assistant Interaction Engine, Audio & Streaming Stability

Stabilize the interaction loop, audio handling, and streaming responses to ensure reliability, idempotency, and a premium user experience.

## Technical Details

### 1. State Machine Implementation
- Define a strict `AssistenteStatus` type with all required states (idle, listening, processing, etc.).
- Implement a centralized state transition logic to prevent invalid states.

### 2. Audio & Transcription Refactoring
- Separate `interim`, `final`, and `confirmed` transcripts in the state.
- Update UI to show interim results as a preview only.
- Add a "Review & Confirm" step for voice commands before sending.
- Implement microphone instance management (singleton pattern) with proper cleanup.

### 3. Request & Idempotency Management
- Generate unique `command_id` and `idempotency_key` for every interaction.
- Implement multi-click prevention and request locking.
- Add a request manager that allows only one active operation per session.

### 4. Streaming Robustness
- Ensure assistant message IDs remain stable during streaming.
- Implement fragment accumulation logic that handles tool calls gracefully.
- Add error recovery for interrupted streams (retry without data loss).

### 5. Error Handling & Recovery
- Standardize error messages with specific recovery steps and correlation IDs.
- Ensure technical failures don't hang the UI (auto-release processing states).

## File Changes

### Frontend Logic & Hooks
- `src/components/ia/hooks/useAssistenteVoice.ts`: Refactor microphone logic and transcript separation.
- `src/components/ia/hooks/useAssistenteActions.ts`: Implement idempotency keys and strict state transitions.
- `src/components/ia/AssistenteIaSidebar.tsx`: Update UI to support transcription review and state-based controls.

### Types & Constants
- `src/types/ia.ts` (or equivalent): Add new states and interface definitions.
