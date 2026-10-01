-- Counters that public lists read instead of aggregating `submissions` on every request:
--   questions.published_count / pending_review_count / rejected_count / latest_published_at
--   departments.published_count
--   user.published_submission_count / published_view_count
-- Written by hand (drizzle-kit doesn't model triggers); don't edit once applied.
--
-- The submission triggers recompute the affected question and uploader from their
-- (indexed) submissions rather than adding deltas, so a status change, a move to
-- another question or a delete can't leave a counter off by one. Only paper views,
-- by far the most frequent write, are applied as a delta.

-- Backfill first: the triggers below would otherwise fire on these updates.
UPDATE `questions`
SET `published_count` = (SELECT count(*) FROM `submissions` s WHERE s.`question_id` = `questions`.`id` AND s.`status` = 'published'),
    `pending_review_count` = (SELECT count(*) FROM `submissions` s WHERE s.`question_id` = `questions`.`id` AND s.`status` = 'pending_review'),
    `rejected_count` = (SELECT count(*) FROM `submissions` s WHERE s.`question_id` = `questions`.`id` AND s.`status` = 'rejected'),
    `latest_published_at` = (SELECT max(s.`created_at`) FROM `submissions` s WHERE s.`question_id` = `questions`.`id` AND s.`status` = 'published');
--> statement-breakpoint
UPDATE `departments`
SET `published_count` = (SELECT coalesce(sum(q.`published_count`), 0) FROM `questions` q WHERE q.`department_id` = `departments`.`id`);
--> statement-breakpoint
UPDATE `user`
SET `published_submission_count` = (SELECT count(*) FROM `submissions` s WHERE s.`uploader_id` = `user`.`id` AND s.`status` = 'published'),
    `published_view_count` = (SELECT coalesce(sum(s.`view_count`), 0) FROM `submissions` s WHERE s.`uploader_id` = `user`.`id` AND s.`status` = 'published');
--> statement-breakpoint
CREATE TRIGGER `submissions_counters_after_insert` AFTER INSERT ON `submissions`
BEGIN
  UPDATE `questions`
  SET `published_count` = (SELECT count(*) FROM `submissions` WHERE `question_id` = NEW.`question_id` AND `status` = 'published'),
      `pending_review_count` = (SELECT count(*) FROM `submissions` WHERE `question_id` = NEW.`question_id` AND `status` = 'pending_review'),
      `rejected_count` = (SELECT count(*) FROM `submissions` WHERE `question_id` = NEW.`question_id` AND `status` = 'rejected'),
      `latest_published_at` = (SELECT max(`created_at`) FROM `submissions` WHERE `question_id` = NEW.`question_id` AND `status` = 'published')
  WHERE `id` = NEW.`question_id`;
  UPDATE `user`
  SET `published_submission_count` = (SELECT count(*) FROM `submissions` WHERE `uploader_id` = NEW.`uploader_id` AND `status` = 'published'),
      `published_view_count` = (SELECT coalesce(sum(`view_count`), 0) FROM `submissions` WHERE `uploader_id` = NEW.`uploader_id` AND `status` = 'published')
  WHERE `id` = NEW.`uploader_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `submissions_counters_after_delete` AFTER DELETE ON `submissions`
BEGIN
  UPDATE `questions`
  SET `published_count` = (SELECT count(*) FROM `submissions` WHERE `question_id` = OLD.`question_id` AND `status` = 'published'),
      `pending_review_count` = (SELECT count(*) FROM `submissions` WHERE `question_id` = OLD.`question_id` AND `status` = 'pending_review'),
      `rejected_count` = (SELECT count(*) FROM `submissions` WHERE `question_id` = OLD.`question_id` AND `status` = 'rejected'),
      `latest_published_at` = (SELECT max(`created_at`) FROM `submissions` WHERE `question_id` = OLD.`question_id` AND `status` = 'published')
  WHERE `id` = OLD.`question_id`;
  UPDATE `user`
  SET `published_submission_count` = (SELECT count(*) FROM `submissions` WHERE `uploader_id` = OLD.`uploader_id` AND `status` = 'published'),
      `published_view_count` = (SELECT coalesce(sum(`view_count`), 0) FROM `submissions` WHERE `uploader_id` = OLD.`uploader_id` AND `status` = 'published')
  WHERE `id` = OLD.`uploader_id`;
END;
--> statement-breakpoint
-- Publishing, rejecting, re-queueing (also by the report trigger in 0001), and moving a
-- paper to another question. Recomputes the old and the new question and uploader.
CREATE TRIGGER `submissions_counters_after_update` AFTER UPDATE OF `status`, `question_id`, `uploader_id` ON `submissions`
WHEN OLD.`status` IS NOT NEW.`status`
  OR OLD.`question_id` IS NOT NEW.`question_id`
  OR OLD.`uploader_id` IS NOT NEW.`uploader_id`
BEGIN
  UPDATE `questions`
  SET `published_count` = (SELECT count(*) FROM `submissions` WHERE `question_id` = `questions`.`id` AND `status` = 'published'),
      `pending_review_count` = (SELECT count(*) FROM `submissions` WHERE `question_id` = `questions`.`id` AND `status` = 'pending_review'),
      `rejected_count` = (SELECT count(*) FROM `submissions` WHERE `question_id` = `questions`.`id` AND `status` = 'rejected'),
      `latest_published_at` = (SELECT max(`created_at`) FROM `submissions` WHERE `question_id` = `questions`.`id` AND `status` = 'published')
  WHERE `id` IN (OLD.`question_id`, NEW.`question_id`);
  UPDATE `user`
  SET `published_submission_count` = (SELECT count(*) FROM `submissions` WHERE `uploader_id` = `user`.`id` AND `status` = 'published'),
      `published_view_count` = (SELECT coalesce(sum(`view_count`), 0) FROM `submissions` WHERE `uploader_id` = `user`.`id` AND `status` = 'published')
  WHERE `id` IN (OLD.`uploader_id`, NEW.`uploader_id`);
END;
--> statement-breakpoint
-- A view of a published paper. When the status or uploader changes in the same
-- statement, the trigger above recomputes the totals instead.
CREATE TRIGGER `submissions_counters_after_view` AFTER UPDATE OF `view_count` ON `submissions`
WHEN OLD.`status` = 'published' AND NEW.`status` = 'published'
  AND OLD.`uploader_id` IS NEW.`uploader_id`
  AND NEW.`uploader_id` IS NOT NULL
BEGIN
  UPDATE `user`
  SET `published_view_count` = `published_view_count` + NEW.`view_count` - OLD.`view_count`
  WHERE `id` = NEW.`uploader_id`;
END;
--> statement-breakpoint
-- Department totals follow their questions' published counts as deltas.
CREATE TRIGGER `questions_counters_after_update` AFTER UPDATE OF `published_count`, `department_id` ON `questions`
WHEN OLD.`published_count` <> NEW.`published_count`
  OR OLD.`department_id` <> NEW.`department_id`
BEGIN
  UPDATE `departments`
  SET `published_count` = `published_count` - OLD.`published_count`
  WHERE `id` = OLD.`department_id`;
  UPDATE `departments`
  SET `published_count` = `published_count` + NEW.`published_count`
  WHERE `id` = NEW.`department_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `questions_counters_after_delete` AFTER DELETE ON `questions`
WHEN OLD.`published_count` <> 0
BEGIN
  UPDATE `departments`
  SET `published_count` = `published_count` - OLD.`published_count`
  WHERE `id` = OLD.`department_id`;
END;
