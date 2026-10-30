-- `questions.versions_pending`: an exam whose published papers, or their texts,
-- changed since the cron last sorted them into versions (services/versions.ts). Set
-- whenever a paper is published, unpublished, moved to another exam or deleted, and
-- when a published paper's text is read. Don't edit once applied.
CREATE TRIGGER `submissions_versions_after_insert` AFTER INSERT ON `submissions`
WHEN NEW.`status` = 'published' AND NEW.`question_id` IS NOT NULL
BEGIN
  UPDATE `questions` SET `versions_pending` = 1 WHERE `id` = NEW.`question_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `submissions_versions_after_update` AFTER UPDATE OF `status`, `question_id` ON `submissions`
WHEN (OLD.`status` = 'published' OR NEW.`status` = 'published')
  AND (OLD.`status` IS NOT NEW.`status` OR OLD.`question_id` IS NOT NEW.`question_id`)
BEGIN
  UPDATE `questions` SET `versions_pending` = 1
  WHERE `id` IN (OLD.`question_id`, NEW.`question_id`);
END;
--> statement-breakpoint
CREATE TRIGGER `submissions_versions_after_delete` AFTER DELETE ON `submissions`
WHEN OLD.`status` = 'published' AND OLD.`question_id` IS NOT NULL
BEGIN
  UPDATE `questions` SET `versions_pending` = 1 WHERE `id` = OLD.`question_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `submission_texts_versions_after_insert` AFTER INSERT ON `submission_texts`
WHEN NEW.`text` IS NOT NULL
BEGIN
  UPDATE `questions` SET `versions_pending` = 1
  WHERE `id` = (
    SELECT `question_id` FROM `submissions`
    WHERE `id` = NEW.`submission_id` AND `status` = 'published'
  );
END;
--> statement-breakpoint
CREATE TRIGGER `submission_texts_versions_after_update` AFTER UPDATE OF `text` ON `submission_texts`
WHEN OLD.`text` IS NOT NEW.`text`
BEGIN
  UPDATE `questions` SET `versions_pending` = 1
  WHERE `id` = (
    SELECT `question_id` FROM `submissions`
    WHERE `id` = NEW.`submission_id` AND `status` = 'published'
  );
END;
--> statement-breakpoint
-- The exams that already have more than one published paper.
UPDATE `questions` SET `versions_pending` = 1 WHERE `published_count` > 1;
