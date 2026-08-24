# Plan - Implementation of Care Programs (Phase 4)

Audit and validate the entire module to ensure security, data integrity, and correct end-to-end operation with real data.

## Security and Permissions
- **RLS & Isolation**: Verify that no user can view or modify programs from another establishment.
- **Granular Permissions**: Implement and test specific permissions for:
    - Catalog viewing and program creation/editing.
    - Sales, discounts, and validity adjustments.
    - Credit reservation, adjustment, and reconciliation.
    - Financial consultation and report exporting.
- **Auditing**: Ensure every action (sale, scheduling, payment, adjustment) is logged with User ID, Action, Timestamp, and previous/post values.

## Reconciliation Logic
- **Credit Reconciliation**: Automated check between contract composition, created credits, reservations, consumption, and current balance.
- **Financial Reconciliation**: Comparison between sold price, accounts receivable, received amounts, and revenue recognition.

## Edge Case Testing
- Testing edited programs after sale, inactivated services, duplicated clients, partial payments, and expired programs.
- Handling race conditions (double clicks, two tabs) and network failures during credit transactions.

## Controlled End-to-End Test
- Execution of the full cycle: Program Creation -> Sale -> Payment -> Scheduling -> Credit Reservation -> Attendance Completion -> Credit Consumption.
- Verification via AI Assistant, Customer Profile, Dashboard, and Financial reports.

## Technical Details
- **Tables**: `programas_de_cuidado`, `programas_contratados`, `programas_creditos_movimentacoes`, `ia_audit_logs`.
- **Functions**: Enhanced server functions with multi-tenant validation and audit triggers.
- **Testing**: Manual and automated checks for mobile and desktop consistency.
