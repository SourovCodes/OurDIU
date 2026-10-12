-- `submissions.text_pending`: a published paper with no `submission_texts` row (its
-- text was never read), the text backfill's queue. Kept by these triggers so the cron
-- reads the few pending papers off `submissions_text_pending_idx` instead of joining
-- every published paper to its text (about 5,600 rows a run, every 5 minutes).
-- Text rows are only removed with their paper (ON DELETE CASCADE), so no trigger on
-- deleting them is needed. Don't edit once applied.
CREATE TRIGGER `submissions_text_pending_after_insert` AFTER INSERT ON `submissions`
WHEN NEW.`status` = 'published'
BEGIN
  UPDATE `submissions`
  SET `text_pending` = NOT EXISTS (
    SELECT 1 FROM `submission_texts` WHERE `submission_id` = NEW.`id`
  )
  WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `submissions_text_pending_after_status` AFTER UPDATE OF `status` ON `submissions`
WHEN (OLD.`status` = 'published') <> (NEW.`status` = 'published')
BEGIN
  UPDATE `submissions`
  SET `text_pending` = NEW.`status` = 'published' AND NOT EXISTS (
    SELECT 1 FROM `submission_texts` WHERE `submission_id` = NEW.`id`
  )
  WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `submission_texts_pending_after_insert` AFTER INSERT ON `submission_texts`
BEGIN
  UPDATE `submissions` SET `text_pending` = 0
  WHERE `id` = NEW.`submission_id` AND `text_pending` = 1;
END;
--> statement-breakpoint
-- The papers published before this migration whose text was never read.
UPDATE `submissions` SET `text_pending` = 1
WHERE `status` = 'published'
  AND NOT EXISTS (
    SELECT 1 FROM `submission_texts` WHERE `submission_id` = `submissions`.`id`
  );
