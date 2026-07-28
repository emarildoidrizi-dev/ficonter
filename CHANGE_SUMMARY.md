# FICONTER Financial GPS

## Purpose

Financial GPS turns FICONTER's existing Wealth Engine data into a calm, prioritized customer journey. It does not create another balance, score, forecast, or data-entry module.

## Customer experience

- One clearly ranked action instead of a long undifferentiated report
- Six understandable stages: Set up, Stabilize, Protect, Build, Grow, Freedom
- A three-step action path with direct links to existing modules
- Four plain-language snapshot metrics
- Explicit guidance confidence and profile-completeness states
- A compact Financial GPS card on Overview
- Realtime recalculation when financial records change
- A clear statement that FICONTER never holds, transfers, invests, or reserves money

## Architecture

- Reuses `get_ai_insights_inputs`
- Reuses the existing deterministic Smart Engine and Wealth Engine calculations
- Reuses Guided Financial Setup acknowledgements
- Does not duplicate transaction, bill, debt, savings, goal, net-worth, or financial-independence calculations
- Requires no new database objects
