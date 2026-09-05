DapurKu v3.1.0
============

New in v3
- Persistent Light / Dark mode toggle.
- Optional Supabase email/password login.
- Shared Kitchen: owner adds another email; both accounts can update the same pantry, shopping list and history.
- Local-first: app still works offline and queues cloud changes until online.
- Purchase date can be entered when first creating pantry/shopping items.
- Finish Shopping defaults to today's purchase date and records it automatically.
- Shopping list shows Last bought date automatically next time.

FAMILY SYNC SETUP
1. Create a free Supabase project.
2. Open SQL Editor and run SETUP_SUPABASE.sql once.
3. In Supabase Project Settings / API, copy:
   - Project URL
   - Publishable key (or legacy anon key)
   NEVER use service_role / secret key in this PWA.
4. Edit config.js:
   supabaseUrl: 'https://YOURPROJECT.supabase.co'
   supabaseKey: 'YOUR_PUBLISHABLE_KEY'
5. In Supabase Authentication > URL Configuration, set your GitHub Pages URL as Site URL and add it to Redirect URLs.
6. Upload all files to GitHub Pages.
7. Open DapurKu > More > Family Sync > Create Account.
8. Kitchen owner signs in and enters partner email under Share this kitchen.
9. Partner creates/signs in with exactly that email, then taps Sync Now if needed.
10. Select the shared kitchen if more than one kitchen appears.

GITHUB PAGES
Upload the CONTENTS of this folder to the repository root, including config.js and SETUP_SUPABASE.sql. Enable Settings > Pages > Deploy from branch > main / root.

Important
- Built-in recipes are not copied to Supabase; each device already contains them.
- Custom recipes are synced.
- Theme is per-device and not synced.
- If two offline devices edit the exact same record before reconnecting, the last synced edit wins for that record.


V3.1 UPDATE
- Item-specific grocery icons with automatic name matching and a large manual icon picker.
- Pantry/shopping categories are in Bahasa Melayu.
- Removed item Location field and location filter to make entry faster.
- Pantry now filters by category instead of location.

DapurKu v3.3 SYNC FIX
---------------------
If Supabase was already set up using v3.0-v3.2, DO NOT rerun the full setup.
Run MIGRATE_v3_3_SYNC_FIX.sql once in Supabase SQL Editor instead.
It merges duplicate kitchens owned by the same account and prevents new duplicates.

v3.3 also fixes iPhone/iOS PWA sync by:
- never caching Supabase/API responses in the service worker
- using no-store for Supabase GET requests
- pulling fresh cloud data when the PWA returns to the foreground
- enabling Supabase Realtime worker support
