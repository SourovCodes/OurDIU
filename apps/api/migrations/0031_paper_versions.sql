ALTER TABLE `questions` ADD `versions_pending` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `questions_versions_pending_idx` ON `questions` (`id`) WHERE "questions"."versions_pending" = 1;--> statement-breakpoint
ALTER TABLE `submissions` ADD `quality` integer;--> statement-breakpoint
ALTER TABLE `submissions` ADD `quality_note` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `version_group` integer;--> statement-breakpoint
ALTER TABLE `submissions` ADD `version_label` text;--> statement-breakpoint
CREATE INDEX `submissions_quality_pending_idx` ON `submissions` (`id`) WHERE "submissions"."status" = 'published' and "submissions"."quality" is null and "submissions"."quality_note" is null;