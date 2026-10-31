-- Copies aren't rated or sorted into versions any more (docs/PLAN.md, decision 71):
-- the triggers that queued exams for sorting and the cron's indexes go. The columns
-- stay until the code that read them is gone from every deployed Worker.
DROP INDEX `questions_versions_pending_idx`;--> statement-breakpoint
DROP INDEX `submissions_quality_pending_idx`;--> statement-breakpoint
DROP TRIGGER `submissions_versions_after_insert`;--> statement-breakpoint
DROP TRIGGER `submissions_versions_after_update`;--> statement-breakpoint
DROP TRIGGER `submissions_versions_after_delete`;--> statement-breakpoint
DROP TRIGGER `submission_texts_versions_after_insert`;--> statement-breakpoint
DROP TRIGGER `submission_texts_versions_after_update`;
