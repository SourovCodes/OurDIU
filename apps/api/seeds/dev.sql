-- Sample data for local development only. Re-running replaces all question data.
-- Applied by `pnpm db:seed` (seeds/seed-local.mjs), which also uploads the PDFs to local R2.
-- Timestamps are Unix milliseconds.

DELETE FROM submission_reports;
DELETE FROM submission_votes;
DELETE FROM submission_analyses;
DELETE FROM submission_texts;
DELETE FROM submissions;
DELETE FROM questions;
DELETE FROM courses;
DELETE FROM departments;
DELETE FROM semesters;
DELETE FROM exam_types;
DELETE FROM "user" WHERE id LIKE 'seed-user-%';
-- Accounts created by e2e tests and local previews (sessions and accounts cascade).
DELETE FROM "user" WHERE email LIKE '%@example.com' OR id LIKE 'e2e-pool-%';

-- Sample contributors. Sign-in is Google-only and these addresses aren't Google
-- accounts, so nobody logs in as them (the e2e tests create sessions directly).
INSERT INTO "user" (id, name, email, username, created_at, updated_at) VALUES
  ('seed-user-1', 'Ayesha Rahman', 'ayesha@seed.local', 'ayesha', 1756684800000, 1756684800000),
  ('seed-user-2', 'Tanvir Hasan', 'tanvir@seed.local', 'tanvir_hasan', 1760486400000, 1760486400000),
  ('seed-user-3', 'Nusrat Jahan', 'nusrat@seed.local', 'nusrat.jahan', 1768867200000, 1768867200000);

-- The admin the e2e tests use. To try the admin panel yourself, log in with Google
-- and run `pnpm make-admin <your email>`.
INSERT INTO "user" (id, name, email, email_verified, role, username) VALUES
  ('seed-user-admin', 'Admin', 'admin@seed.local', 1, 'admin', 'seed_admin');

INSERT INTO departments (id, name, short_name) VALUES
  (1, 'Computer Science and Engineering', 'CSE'),
  (2, 'Electrical and Electronic Engineering', 'EEE'),
  (3, 'Business Administration', 'BBA');

INSERT INTO courses (id, name, department_id) VALUES
  (1, 'Data Structures', 1),
  (2, 'Algorithms', 1),
  (3, 'Database Systems', 1),
  (4, 'Discrete Mathematics', 1),
  (5, 'Circuit Analysis', 2),
  (6, 'Digital Electronics', 2),
  (7, 'Principles of Accounting', 3),
  (8, 'Marketing Management', 3),
  -- Same course name in two departments, to show the department suffix.
  (9, 'Discrete Mathematics', 2);

-- Semester names are a term (Spring, Summer, Fall, Short) and a two-digit year.
INSERT INTO semesters (id, name) VALUES
  (1, 'Spring 24'), (2, 'Summer 24'), (3, 'Fall 24'), (4, 'Spring 25'),
  (5, 'Summer 25'), (6, 'Fall 25'), (7, 'Spring 26'), (8, 'Summer 26');

INSERT INTO exam_types (id, name) VALUES
  (1, 'Midterm'),
  (2, 'Final'),
  (3, 'Class Test');

INSERT INTO questions (id, department_id, course_id, semester_id, exam_type_id) VALUES
  (1, 1, 1, 2, 1),
  (2, 1, 1, 2, 2),
  (3, 1, 2, 3, 2),
  (4, 1, 3, 5, 1),
  (5, 1, 4, 1, 3),
  (6, 2, 5, 1, 2),
  (7, 2, 6, 3, 1),
  (8, 3, 7, 1, 2),
  (9, 3, 8, 4, 1),
  (10, 2, 9, 2, 2);

-- file_size is set by the seed script from the uploaded sample PDF.
-- #14 has no uploader, to show an unknown contributor.
INSERT INTO submissions (id, question_id, status, file_key, file_size, uploader_id, created_at, updated_at) VALUES
  (1, 1, 'published', 'submissions/seed-01.pdf', 0, 'seed-user-1', 1773100800000, 1773100800000),
  (2, 1, 'published', 'submissions/seed-02.pdf', 0, 'seed-user-2', 1762041600000, 1762041600000),
  (3, 2, 'published', 'submissions/seed-03.pdf', 0, 'seed-user-1', 1769904000000, 1769904000000),
  (4, 3, 'published', 'submissions/seed-04.pdf', 0, 'seed-user-3', 1776643200000, 1776643200000),
  (5, 4, 'published', 'submissions/seed-05.pdf', 0, 'seed-user-1', 1765756800000, 1765756800000),
  (6, 5, 'published', 'submissions/seed-06.pdf', 0, 'seed-user-2', 1769904000000, 1769904000000),
  (7, 6, 'published', 'submissions/seed-07.pdf', 0, 'seed-user-3', 1777939200000, 1777939200000),
  (8, 7, 'published', 'submissions/seed-08.pdf', 0, 'seed-user-1', 1773100800000, 1773100800000),
  (9, 8, 'published', 'submissions/seed-09.pdf', 0, 'seed-user-2', 1765756800000, 1765756800000),
  (10, 9, 'pending_review', 'submissions/seed-10.pdf', 0, 'seed-user-3', 1777939200000, 1777939200000),
  (11, 10, 'published', 'submissions/seed-11.pdf', 0, 'seed-user-1', 1776643200000, 1776643200000),
  (12, 3, 'rejected', 'submissions/seed-12.pdf', 0, 'seed-user-2', 1773100800000, 1773100800000),
  (13, 1, 'pending_review', 'submissions/seed-13.pdf', 0, 'seed-user-3', 1777939200000, 1777939200000),
  (14, 1, 'rejected', 'submissions/seed-14.pdf', 0, NULL, 1769904000000, 1769904000000);

-- A pending submission proposing a new course and semester: no question until approved.
INSERT INTO submissions (id, status, file_key, file_size, uploader_id, department_id, custom_course_name, custom_semester_name, exam_type_id, created_at, updated_at) VALUES
  (15, 'pending_review', 'submissions/seed-15.pdf', 0, 'seed-user-3', 1, 'Operating Systems', 'Short 25', 2, 1778544000000, 1778544000000);

-- The Data Structures midterm from another semester, for the question page's
-- "Other semesters", and a section and batch on one paper.
INSERT INTO questions (id, department_id, course_id, semester_id, exam_type_id) VALUES
  (11, 1, 1, 1, 1);
INSERT INTO submissions (id, question_id, status, file_key, file_size, uploader_id, created_at, updated_at) VALUES
  (16, 11, 'published', 'submissions/seed-16.pdf', 0, 'seed-user-3', 1760000000000, 1760000000000);
UPDATE submissions SET section = 'A', batch = '61' WHERE id = 1;
UPDATE submissions SET rejection_reason = 'This PDF contains multiple question papers. Please upload each question paper as a separate PDF.' WHERE id = 12;
UPDATE submissions SET rejection_reason = 'This file is not a valid exam question paper.' WHERE id = 14;

-- AI analyses. #15: the AI reads a different semester and a section. #13: the
-- AI found two papers in one file.
INSERT INTO submission_analyses (submission_id, run_id, status, attempts, model, original_bytes, sent_bytes, is_question_paper, paper_count, note, department_id, department_name, department_short_name, course_id, course_name, semester_id, semester_name, exam_type_id, exam_type_name, section, batch, completed_at) VALUES
  (15, 'seed-run-15', 'completed', 1, 'seed', 0, 0, 1, 1, 'A single final exam paper for Operating Systems.', 1, 'Computer Science and Engineering', 'CSE', NULL, 'Operating Systems', 5, 'Summer 25', 2, 'Final', 'B', NULL, 1778544060000),
  (13, 'seed-run-13', 'completed', 1, 'seed', 0, 0, 1, 2, 'The file contains two different midterm papers.', 1, 'Computer Science and Engineering', 'CSE', 1, 'Data Structures', 2, 'Summer 24', 1, 'Midterm', NULL, NULL, 1777939260000);

-- Papers' text as the AI reads it (the FTS index follows by trigger). #13 is pending,
-- so its text is never shown or found.
INSERT INTO submission_texts (submission_id, text, model) VALUES
  (1, 'Daffodil International University
Department of Computer Science and Engineering
Midterm Examination, Summer 2024
Course: CSE 134 Data Structures
Time: 1 hour 30 minutes    Full marks: 25

1. a) What is a stack? Explain push and pop with an example. [5]
   b) Convert the infix expression A + B * C to postfix using a stack. [5]

2. a) Write an algorithm to insert a node at the end of a singly linked list. [5]
   b) Compare arrays and linked lists. [5]

3. Explain a circular queue. Why is it better than a linear queue? [5]', 'seed'),
  (4, 'Daffodil International University
Final Examination, Fall 2024
Course: CSE 214 Algorithms
Full marks: 40

1. Find the shortest paths from vertex A with Dijkstra''s algorithm. [10]
[Figure: a weighted directed graph with vertices A to F]

2. Sort 38, 27, 43, 3, 9, 82, 10 with merge sort and show every step. [10]

3. What is dynamic programming? Solve the 0/1 knapsack problem for the items below. [10]
Item | Weight | Value
1 | 2 | 12
2 | 1 | 10
3 | 3 | 20

4. Prove that the running time of binary search is O(log n). [10]', 'seed'),
  (13, 'Draft: what is a stack? (pending)', 'seed');

-- Votes; the triggers fill in like_count and dislike_count. Nobody votes on their own paper.
-- Question 1: #1 scores +2 and stays ranked first, #2 scores 0.
INSERT INTO submission_votes (submission_id, user_id, value) VALUES
  (1, 'seed-user-2', 1),
  (1, 'seed-user-3', 1),
  (2, 'seed-user-1', 1),
  (2, 'seed-user-3', -1),
  (4, 'seed-user-1', 1),
  (4, 'seed-user-2', 1),
  (7, 'seed-user-1', 1),
  (11, 'seed-user-2', -1);

-- One open report, below the auto-hide threshold; the trigger counts it.
INSERT INTO submission_reports (submission_id, reporter_id, reason, details) VALUES
  (2, 'seed-user-3', 'unreadable', 'The second page is too blurry to read.');

-- View counters (question page views and paper views are counted separately).
UPDATE questions SET view_count = 40 + id * 23;
UPDATE submissions SET view_count = CASE id
  WHEN 1 THEN 184
  WHEN 2 THEN 97
  WHEN 4 THEN 152
  ELSE 12 + length(file_key) END
WHERE status = 'published';
