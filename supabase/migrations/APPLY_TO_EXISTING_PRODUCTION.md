# Existing Production procedure

The baseline already describes the live Production database and must not be
executed there.

For this hardening release, run only:

`20260805000100_bill_paid_unpaid_reversal.sql`

This additive migration creates the authenticated `mark_bill_unpaid` RPC used by
the Bills interface. It does not alter customer records during installation.
