# Seeds

Reference data the application cannot run without. One file per table (or
tightly related group), numbered so dependencies load first. Every statement
must be idempotent — `INSERT ... ON DUPLICATE KEY UPDATE` keyed on the natural
unique column (`iso2`, `code_name`, `code`) — so `npm run seed` is safe to
re-run after any migration.

Name files by load order, one per table or tightly related group
(`010_countries.sql`, `020_company_types.sql`, ...).

Seeds are data, not schema: never put DDL here. Transactional data (trades,
partners) belongs in test fixtures, not seeds.
