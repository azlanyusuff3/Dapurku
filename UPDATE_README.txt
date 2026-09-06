DapurKu v3.4 — UPDATE ONLY

Use this package if DapurKu is already deployed and Supabase config.js is already working.

Replace/upload only the files in this package.
DO NOT delete or overwrite your existing config.js.
No new Supabase SQL migration is required for v3.4 if the v3.3 sync migration was already applied.

Data safety:
- Same IndexedDB database name/version.
- No reset/clear is run during upgrade.
- Same Supabase tables/schema.
- Existing pantry, shopping, history, recipes, account and shared kitchen remain.

New in v3.4:
- Delete button on every Shopping List row, including auto Low/Out rows.
- Auto Low/Out deletion is dismissed for the current stock state, so it does not instantly reappear.
- Purchase History moved into one compact button in More.
- History Manager can delete one record or Clear All history.
- New navy + clear blue + warm amber glass-style UI; purple removed.
