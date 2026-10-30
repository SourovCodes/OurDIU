ALTER TABLE `submissions` ADD `file_sha256` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `quality_checks` text;--> statement-breakpoint
CREATE INDEX `submissions_file_sha256_idx` ON `submissions` (`file_sha256`);--> statement-breakpoint
-- The exams sorted into versions by the first prompt, which split copies of one
-- paper and made up labels such as "Set B": sorted again by the stricter one
-- (docs/PLAN.md, decision 68). Raw SQL, so `updated_at` stays.
UPDATE `questions` SET `versions_pending` = 1
WHERE `id` IN (SELECT `question_id` FROM `submissions` WHERE `version_group` IS NOT NULL);--> statement-breakpoint
UPDATE `submissions` SET `version_group` = NULL, `version_label` = NULL
WHERE `version_group` IS NOT NULL;
