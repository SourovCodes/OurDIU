-- Triggers that keep the denormalised counters on `submissions` in sync.
-- Written by hand (drizzle-kit doesn't model triggers); don't edit once applied.

-- Likes / dislikes follow submission_votes on insert, change and delete.
CREATE TRIGGER `submission_votes_after_insert` AFTER INSERT ON `submission_votes`
BEGIN
  UPDATE `submissions`
  SET `like_count` = `like_count` + (NEW.`value` = 1),
      `dislike_count` = `dislike_count` + (NEW.`value` = -1)
  WHERE `id` = NEW.`submission_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `submission_votes_after_update` AFTER UPDATE OF `value` ON `submission_votes`
BEGIN
  UPDATE `submissions`
  SET `like_count` = `like_count` - (OLD.`value` = 1) + (NEW.`value` = 1),
      `dislike_count` = `dislike_count` - (OLD.`value` = -1) + (NEW.`value` = -1)
  WHERE `id` = NEW.`submission_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `submission_votes_after_delete` AFTER DELETE ON `submission_votes`
BEGIN
  UPDATE `submissions`
  SET `like_count` = `like_count` - (OLD.`value` = 1),
      `dislike_count` = `dislike_count` - (OLD.`value` = -1)
  WHERE `id` = OLD.`submission_id`;
END;
--> statement-breakpoint
-- A new pending report counts towards the paper; at 3 pending reports
-- (REPORT_HIDE_THRESHOLD in @ourdiu/shared) a published paper goes back to pending review.
CREATE TRIGGER `submission_reports_after_insert` AFTER INSERT ON `submission_reports`
WHEN NEW.`status` = 'pending'
BEGIN
  UPDATE `submissions`
  SET `pending_report_count` = `pending_report_count` + 1
  WHERE `id` = NEW.`submission_id`;
  UPDATE `submissions`
  SET `status` = 'pending_review'
  WHERE `id` = NEW.`submission_id`
    AND `status` = 'published'
    AND `pending_report_count` >= 3;
END;
--> statement-breakpoint
-- Resolving or dismissing a report (or reopening one) adjusts the pending count.
CREATE TRIGGER `submission_reports_after_update` AFTER UPDATE OF `status` ON `submission_reports`
WHEN (OLD.`status` = 'pending') <> (NEW.`status` = 'pending')
BEGIN
  UPDATE `submissions`
  SET `pending_report_count` = `pending_report_count` + (NEW.`status` = 'pending') - (OLD.`status` = 'pending')
  WHERE `id` = NEW.`submission_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `submission_reports_after_delete` AFTER DELETE ON `submission_reports`
WHEN OLD.`status` = 'pending'
BEGIN
  UPDATE `submissions`
  SET `pending_report_count` = `pending_report_count` - 1
  WHERE `id` = OLD.`submission_id`;
END;
