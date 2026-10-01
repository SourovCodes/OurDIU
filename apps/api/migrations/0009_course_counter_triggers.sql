-- courses.published_count: published papers per course, like departments.published_count
-- (migration 0006), so course lists can show counts and leave out empty courses.
-- Written by hand (drizzle-kit doesn't model triggers); don't edit once applied.

-- Backfill first: the triggers below would otherwise fire on this update.
UPDATE `courses`
SET `published_count` = (SELECT coalesce(sum(q.`published_count`), 0) FROM `questions` q WHERE q.`course_id` = `courses`.`id`);
--> statement-breakpoint
-- Course totals follow their questions' published counts as deltas.
CREATE TRIGGER `questions_course_counters_after_update` AFTER UPDATE OF `published_count`, `course_id` ON `questions`
WHEN OLD.`published_count` <> NEW.`published_count`
  OR OLD.`course_id` <> NEW.`course_id`
BEGIN
  UPDATE `courses`
  SET `published_count` = `published_count` - OLD.`published_count`
  WHERE `id` = OLD.`course_id`;
  UPDATE `courses`
  SET `published_count` = `published_count` + NEW.`published_count`
  WHERE `id` = NEW.`course_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `questions_course_counters_after_delete` AFTER DELETE ON `questions`
WHEN OLD.`published_count` <> 0
BEGIN
  UPDATE `courses`
  SET `published_count` = `published_count` - OLD.`published_count`
  WHERE `id` = OLD.`course_id`;
END;
