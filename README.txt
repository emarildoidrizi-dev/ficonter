FICONTER decimal money input fix

This package contains the manual patch for comma/dot decimal money inputs.

Fixes:
- Transactions accept 2345,67 and 2345.67
- Monthly Budget accepts 2345,67 and 2345.67
- Shared money parser normalizes European and English number formats

Suggested branch: fix/decimal-money-inputs

Apply the patch from the repository root with:
  git apply ficonter-decimal-money-input.patch

Then test Transactions and Monthly Budget before committing.
