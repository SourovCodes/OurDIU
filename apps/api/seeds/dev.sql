-- Sample data for local development only. Re-running replaces it.
-- Applied by `pnpm db:seed` (seeds/seed-local.mjs).

DELETE FROM departments;
DELETE FROM "user" WHERE id LIKE 'seed-user-%';
-- Accounts created by e2e tests and local previews (sessions and accounts cascade).
DELETE FROM "user" WHERE email LIKE '%@example.com';

-- The admin the e2e tests use. To try the admin panel yourself, add your email to
-- ADMIN_EMAILS in apps/web/.dev.vars before your first log-in, or log in and run
-- `pnpm make-admin <your email>`.
INSERT INTO "user" (id, name, email, email_verified, role, username) VALUES
  ('seed-user-admin', 'Admin', 'admin@seed.local', 1, 'admin', 'seed_admin');

INSERT INTO departments (id, name, short_name) VALUES
  (1, 'Computer Science and Engineering', 'CSE'),
  (2, 'Software Engineering', 'SWE'),
  (3, 'Electrical and Electronic Engineering', 'EEE'),
  (4, 'Business Administration', 'BBA');
