# Credit Card Balance Left To Pay Fix

This patch corrects the previous mirroring rule.

Previous behavior:
- Current balance ↔ Statement balance for the active month.

New behavior:
- Current balance ↔ Balance left to pay, always.
- Statement balance is an independent monthly record from the issuer.
- Recording a statement no longer changes current balance.
