// Staging verifier companion for Monthly Planner E2EE.
// The authoritative enforcement checks are executed against Supabase staging:
// encrypted v1 required, private plaintext fields null, Realtime enabled,
// plaintext writes rejected, and encrypted plan RPC available.
console.log('Monthly Planner E2EE verifier: use staging database checks.');
