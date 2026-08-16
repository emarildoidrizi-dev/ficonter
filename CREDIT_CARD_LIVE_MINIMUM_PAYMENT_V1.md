# Credit Card Live Minimum Payment V1

Current-month credit-card minimum payment now follows the live Current Balance.

- Current month minimum = 3% of Current Balance.
- Purchases, fees, interest, refunds, payments, and balance adjustments therefore change the displayed minimum immediately because they change Current Balance.
- Balance Left to Pay continues to mirror Current Balance.
- Statement Balance remains a historical issuer snapshot only.
- Historical monthly minimum-payment records remain historical; they are not recalculated from today's balance.
- Cross-module base-currency debt summaries calculate credit-card minimums from live current balances instead of stale stored minimum-payment fields.

Example: Current Balance 6,358.23 EUR -> live 3% minimum = 190.75 EUR after currency rounding.
