-- Labs are their own courses (docs/PLAN.md, decision 56). Exams filed as "Lab Final"
-- or "Lab Midterm" move to the lab course ("<course> Lab", added where the department
-- doesn't have it) as "Final" or "Midterm", and the two lab exam types go. Exams that
-- become the same exam are combined as an admin merge combines them (services/merge.ts):
-- papers, saves and views move to one, the other redirects (merged_ids). Counters
-- follow by their triggers. Matches names, not ids, so it does nothing where there are
-- no lab exam types (local and e2e databases). Don't edit once applied.

-- CIS's "SP Lab" is "Structured Programming Lab" filed twice: its exams join that
-- course (none is the same exam) and its old page redirects. If one ever were the
-- same exam, moving it breaks the unique exam key and the whole migration fails.
UPDATE `questions`
SET `course_id` = (
  SELECT k.`id` FROM `courses` k JOIN `departments` d ON d.`id` = k.`department_id`
  WHERE d.`short_name` = 'CIS' AND k.`name` = 'Structured Programming Lab'
)
WHERE `course_id` IN (
  SELECT c.`id` FROM `courses` c JOIN `departments` d ON d.`id` = c.`department_id`
  WHERE d.`short_name` = 'CIS' AND c.`name` = 'SP Lab'
)
  AND EXISTS (
    SELECT 1 FROM `courses` k JOIN `departments` d ON d.`id` = k.`department_id`
    WHERE d.`short_name` = 'CIS' AND k.`name` = 'Structured Programming Lab'
  );
--> statement-breakpoint
UPDATE `submissions`
SET `course_id` = (
  SELECT k.`id` FROM `courses` k JOIN `departments` d ON d.`id` = k.`department_id`
  WHERE d.`short_name` = 'CIS' AND k.`name` = 'Structured Programming Lab'
)
WHERE `course_id` IN (
  SELECT c.`id` FROM `courses` c JOIN `departments` d ON d.`id` = c.`department_id`
  WHERE d.`short_name` = 'CIS' AND c.`name` = 'SP Lab'
)
  AND EXISTS (
    SELECT 1 FROM `courses` k JOIN `departments` d ON d.`id` = k.`department_id`
    WHERE d.`short_name` = 'CIS' AND k.`name` = 'Structured Programming Lab'
  );
--> statement-breakpoint
UPDATE `submission_analyses`
SET `course_id` = (
  SELECT k.`id` FROM `courses` k JOIN `departments` d ON d.`id` = k.`department_id`
  WHERE d.`short_name` = 'CIS' AND k.`name` = 'Structured Programming Lab'
)
WHERE `course_id` IN (
  SELECT c.`id` FROM `courses` c JOIN `departments` d ON d.`id` = c.`department_id`
  WHERE d.`short_name` = 'CIS' AND c.`name` = 'SP Lab'
)
  AND EXISTS (
    SELECT 1 FROM `courses` k JOIN `departments` d ON d.`id` = k.`department_id`
    WHERE d.`short_name` = 'CIS' AND k.`name` = 'Structured Programming Lab'
  );
--> statement-breakpoint
UPDATE `merged_ids`
SET `new_id` = (
  SELECT k.`id` FROM `courses` k JOIN `departments` d ON d.`id` = k.`department_id`
  WHERE d.`short_name` = 'CIS' AND k.`name` = 'Structured Programming Lab'
)
WHERE `kind` = 'course'
  AND `new_id` IN (
    SELECT c.`id` FROM `courses` c JOIN `departments` d ON d.`id` = c.`department_id`
    WHERE d.`short_name` = 'CIS' AND c.`name` = 'SP Lab'
  )
  AND EXISTS (
    SELECT 1 FROM `courses` k JOIN `departments` d ON d.`id` = k.`department_id`
    WHERE d.`short_name` = 'CIS' AND k.`name` = 'Structured Programming Lab'
  );
--> statement-breakpoint
INSERT OR REPLACE INTO `merged_ids` (`kind`, `old_id`, `new_id`)
SELECT 'course', c.`id`, k.`id`
FROM `courses` c
JOIN `departments` d ON d.`id` = c.`department_id`
JOIN `courses` k ON k.`department_id` = c.`department_id` AND k.`name` = 'Structured Programming Lab'
WHERE d.`short_name` = 'CIS' AND c.`name` = 'SP Lab';
--> statement-breakpoint
DELETE FROM `courses`
WHERE `id` IN (
  SELECT c.`id` FROM `courses` c JOIN `departments` d ON d.`id` = c.`department_id`
  WHERE d.`short_name` = 'CIS' AND c.`name` = 'SP Lab'
)
  AND EXISTS (
    SELECT 1 FROM `courses` k JOIN `departments` d ON d.`id` = k.`department_id`
    WHERE d.`short_name` = 'CIS' AND k.`name` = 'Structured Programming Lab'
  );
--> statement-breakpoint

-- A lab course for each theory course with lab exams.
INSERT INTO `courses` (`name`, `department_id`)
SELECT DISTINCT c.`name` || ' Lab', c.`department_id`
FROM `questions` q
JOIN `courses` c ON c.`id` = q.`course_id`
JOIN `exam_types` e ON e.`id` = q.`exam_type_id`
WHERE e.`name` IN ('Lab Final', 'Lab Midterm')
  AND c.`name` NOT LIKE '% Lab'
  AND NOT EXISTS (
    SELECT 1 FROM `courses` l
    WHERE l.`department_id` = c.`department_id` AND lower(l.`name`) = lower(c.`name` || ' Lab')
  );
--> statement-breakpoint

-- Where each lab exam goes. Dropped at the end.
CREATE TABLE `_lab_moves` (
  `question_id` integer PRIMARY KEY,
  `course_id` integer NOT NULL,
  `semester_id` integer NOT NULL,
  `exam_type_id` integer NOT NULL,
  `view_count` integer NOT NULL,
  `on_lab_course` integer NOT NULL,
  `survivor_id` integer
);
--> statement-breakpoint
INSERT INTO `_lab_moves` (`question_id`, `course_id`, `semester_id`, `exam_type_id`, `view_count`, `on_lab_course`)
SELECT
  q.`id`,
  CASE WHEN c.`name` LIKE '% Lab' THEN c.`id` ELSE (
    SELECT l.`id` FROM `courses` l
    WHERE l.`department_id` = c.`department_id` AND lower(l.`name`) = lower(c.`name` || ' Lab')
  ) END,
  q.`semester_id`,
  (SELECT t.`id` FROM `exam_types` t WHERE t.`name` = CASE e.`name` WHEN 'Lab Final' THEN 'Final' ELSE 'Midterm' END),
  q.`view_count`,
  c.`name` LIKE '% Lab'
FROM `questions` q
JOIN `courses` c ON c.`id` = q.`course_id`
JOIN `exam_types` e ON e.`id` = q.`exam_type_id`
WHERE e.`name` IN ('Lab Final', 'Lab Midterm');
--> statement-breakpoint

-- The exam each one ends up as: one already there, else the one already on the lab
-- course, then the most viewed, then the oldest.
UPDATE `_lab_moves` SET `survivor_id` = coalesce(
  (
    SELECT q.`id` FROM `questions` q
    WHERE q.`course_id` = `_lab_moves`.`course_id`
      AND q.`semester_id` = `_lab_moves`.`semester_id`
      AND q.`exam_type_id` = `_lab_moves`.`exam_type_id`
  ),
  (
    SELECT m.`question_id` FROM `_lab_moves` m
    WHERE m.`course_id` = `_lab_moves`.`course_id`
      AND m.`semester_id` = `_lab_moves`.`semester_id`
      AND m.`exam_type_id` = `_lab_moves`.`exam_type_id`
    ORDER BY m.`on_lab_course` DESC, m.`view_count` DESC, m.`question_id`
    LIMIT 1
  )
);
--> statement-breakpoint

-- Combined exams: papers, saves (one per user) and views move to the survivor.
UPDATE `submissions`
SET `question_id` = (SELECT m.`survivor_id` FROM `_lab_moves` m WHERE m.`question_id` = `submissions`.`question_id`)
WHERE `question_id` IN (SELECT `question_id` FROM `_lab_moves` WHERE `survivor_id` <> `question_id`);
--> statement-breakpoint
UPDATE OR IGNORE `saved_questions`
SET `question_id` = (SELECT m.`survivor_id` FROM `_lab_moves` m WHERE m.`question_id` = `saved_questions`.`question_id`)
WHERE `question_id` IN (SELECT `question_id` FROM `_lab_moves` WHERE `survivor_id` <> `question_id`);
--> statement-breakpoint
UPDATE `questions`
SET `view_count` = `view_count` + (
  SELECT coalesce(sum(m.`view_count`), 0) FROM `_lab_moves` m
  WHERE m.`survivor_id` = `questions`.`id` AND m.`question_id` <> `questions`.`id`
)
WHERE `id` IN (SELECT `survivor_id` FROM `_lab_moves` WHERE `survivor_id` <> `question_id`);
--> statement-breakpoint
INSERT INTO `question_view_hours` (`question_id`, `hour`, `views`)
SELECT m.`survivor_id`, h.`hour`, h.`views`
FROM `question_view_hours` h
JOIN `_lab_moves` m ON m.`question_id` = h.`question_id`
WHERE m.`survivor_id` <> m.`question_id`
ON CONFLICT (`question_id`, `hour`) DO UPDATE SET `views` = `question_view_hours`.`views` + excluded.`views`;
--> statement-breakpoint
UPDATE `merged_ids`
SET `new_id` = (SELECT m.`survivor_id` FROM `_lab_moves` m WHERE m.`question_id` = `merged_ids`.`new_id`)
WHERE `kind` = 'question'
  AND `new_id` IN (SELECT `question_id` FROM `_lab_moves` WHERE `survivor_id` <> `question_id`);
--> statement-breakpoint
INSERT OR REPLACE INTO `merged_ids` (`kind`, `old_id`, `new_id`)
SELECT 'question', `question_id`, `survivor_id` FROM `_lab_moves` WHERE `survivor_id` <> `question_id`;
--> statement-breakpoint
DELETE FROM `questions`
WHERE `id` IN (SELECT `question_id` FROM `_lab_moves` WHERE `survivor_id` <> `question_id`);
--> statement-breakpoint

-- The rest move, keeping their ids.
UPDATE `questions`
SET
  `course_id` = (SELECT m.`course_id` FROM `_lab_moves` m WHERE m.`question_id` = `questions`.`id`),
  `exam_type_id` = (SELECT m.`exam_type_id` FROM `_lab_moves` m WHERE m.`question_id` = `questions`.`id`),
  `updated_at` = cast(unixepoch('subsecond') * 1000 as integer)
WHERE `id` IN (SELECT `question_id` FROM `_lab_moves` WHERE `survivor_id` = `question_id`);
--> statement-breakpoint

-- Papers awaiting review that propose a lab exam type, and the AI's guesses.
UPDATE `submissions`
SET
  `course_id` = coalesce((
    SELECT l.`id` FROM `courses` c JOIN `courses` l ON l.`department_id` = c.`department_id`
    WHERE c.`id` = `submissions`.`course_id` AND c.`name` NOT LIKE '% Lab'
      AND lower(l.`name`) = lower(c.`name` || ' Lab')
  ), `course_id`),
  `exam_type_id` = (
    SELECT t.`id` FROM `exam_types` e JOIN `exam_types` t
      ON t.`name` = CASE e.`name` WHEN 'Lab Final' THEN 'Final' ELSE 'Midterm' END
    WHERE e.`id` = `submissions`.`exam_type_id`
  )
WHERE `question_id` IS NULL
  AND `exam_type_id` IN (SELECT `id` FROM `exam_types` WHERE `name` IN ('Lab Final', 'Lab Midterm'));
--> statement-breakpoint
UPDATE `submission_analyses`
SET
  `exam_type_id` = (
    SELECT t.`id` FROM `exam_types` e JOIN `exam_types` t
      ON t.`name` = CASE e.`name` WHEN 'Lab Final' THEN 'Final' ELSE 'Midterm' END
    WHERE e.`id` = `submission_analyses`.`exam_type_id`
  ),
  `exam_type_name` = CASE `exam_type_name` WHEN 'Lab Final' THEN 'Final' ELSE 'Midterm' END
WHERE `exam_type_id` IN (SELECT `id` FROM `exam_types` WHERE `name` IN ('Lab Final', 'Lab Midterm'));
--> statement-breakpoint

-- The lab exam types go; their old pages redirect to the plain ones.
UPDATE `merged_ids`
SET `new_id` = (
  SELECT t.`id` FROM `exam_types` e JOIN `exam_types` t
    ON t.`name` = CASE e.`name` WHEN 'Lab Final' THEN 'Final' ELSE 'Midterm' END
  WHERE e.`id` = `merged_ids`.`new_id`
)
WHERE `kind` = 'exam_type'
  AND `new_id` IN (SELECT `id` FROM `exam_types` WHERE `name` IN ('Lab Final', 'Lab Midterm'));
--> statement-breakpoint
INSERT OR REPLACE INTO `merged_ids` (`kind`, `old_id`, `new_id`)
SELECT 'exam_type', e.`id`, t.`id`
FROM `exam_types` e
JOIN `exam_types` t ON t.`name` = CASE e.`name` WHEN 'Lab Final' THEN 'Final' ELSE 'Midterm' END
WHERE e.`name` IN ('Lab Final', 'Lab Midterm');
--> statement-breakpoint
DELETE FROM `exam_types` WHERE `name` IN ('Lab Final', 'Lab Midterm');
--> statement-breakpoint
DROP TABLE `_lab_moves`;
