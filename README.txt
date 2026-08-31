Mortgage Rates Resilience Patch

Run this from the root of weekly-price-drop-report:

  node apply-mortgage-rates-resilience-patch.cjs

Then test:

  npm run mortgage-rates

The patch:
- retries each FRED series up to 3 times
- waits 1s then 2s between retries
- changes a safely detected 15-second FRED timeout to 30 seconds
- reduces a safely detected FRED concurrency constant to 3
- still fails the workflow after all retries are exhausted
- creates a backup of the original TypeScript file
