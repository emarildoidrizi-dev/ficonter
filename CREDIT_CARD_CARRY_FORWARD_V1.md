# Credit Card Carry-Forward V1

## Locked behavior

- **Current Balance** and **Balance Left to Pay** are the same live amount.
- **Minimum Payment Due** for the active month is 3% of Current Balance and updates live.
- **Statement Balance** is a monthly record and does not mirror Current Balance during the month.
- When a new month starts, the amount owed at the start of that month is reconstructed as the **carried-forward balance**.
- If no monthly statement record exists yet, the Statement Balance card shows this carried-forward amount as a provisional monthly basis.
- Opening **Update statement** pre-fills the Statement Balance with the carried-forward amount.
- Saving the statement freezes that amount in `credit_card_monthly_records` as the historical record.
- New purchases, fees, interest, refunds, adjustments, and payments continue changing Current Balance / Balance Left to Pay without rewriting a saved Statement Balance.

## Carry-forward formula

For a target month:

`carried forward = current live balance - all activity balance effects since month start + all payments since month start`

Because credit-card activities already store their signed `balance_effect`, refunds and balance decreases are handled correctly without special-case guessing.

## Example

If August closes with Balance Left to Pay = €6,358.23, September begins with a carried-forward Statement Balance basis of €6,358.23.

If September then has €600 of purchases and €200 of payments:

- Statement Balance record (once saved): €6,358.23
- Current Balance / Balance Left to Pay: €6,758.23
- Live minimum payment: 3% of €6,758.23 = €202.75

At the start of October, the September ending Balance Left to Pay becomes October's carried-forward Statement Balance basis.
