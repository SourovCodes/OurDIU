-- A paper an admin asked to change (status `changes_requested`) is still on its way into
-- the bank, so questions.pending_review_count counts it with the papers waiting for
-- review. Recreates the submission counter triggers of migration 0006 with that one
-- change. No paper had the new status before this migration, so nothing to backfill.
-- Written by hand (drizzle-kit doesn't model triggers); don't edit once applied.
DROP TRIGGER `submissions_counters_after_insert`;
--> statement-breakpoint
DROP TRIGGER `submissions_counters_after_delete`;
--> statement-breakpoint
DROP TRIGGER `submissions_counters_after_update`;
--> statement-breakpoint
CREATE TRIGGER `submissions_counters_after_insert` AFTER INSERT ON `submissions`
BEGIN
  UPDATE `questions`
  SET `published_count` = (SELECT count(*) FROM `submissions` WHERE `question_id` = NEW.`question_id` AND `status` = 'published'),
      `pending_review_count` = (SELECT count(*) FROM `submissions` WHERE `question_id` = NEW.`question_id` AND `status` IN ('pending_review', 'changes_requested')),
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
      `pending_review_count` = (SELECT count(*) FROM `submissions` WHERE `question_id` = OLD.`question_id` AND `status` IN ('pending_review', 'changes_requested')),
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
      `pending_review_count` = (SELECT count(*) FROM `submissions` WHERE `question_id` = `questions`.`id` AND `status` IN ('pending_review', 'changes_requested')),
      `rejected_count` = (SELECT count(*) FROM `submissions` WHERE `question_id` = `questions`.`id` AND `status` = 'rejected'),
      `latest_published_at` = (SELECT max(`created_at`) FROM `submissions` WHERE `question_id` = `questions`.`id` AND `status` = 'published')
  WHERE `id` IN (OLD.`question_id`, NEW.`question_id`);
  UPDATE `user`
  SET `published_submission_count` = (SELECT count(*) FROM `submissions` WHERE `uploader_id` = `user`.`id` AND `status` = 'published'),
      `published_view_count` = (SELECT coalesce(sum(`view_count`), 0) FROM `submissions` WHERE `uploader_id` = `user`.`id` AND `status` = 'published')
  WHERE `id` IN (OLD.`uploader_id`, NEW.`uploader_id`);
END;
