ALTER TABLE `submissions` ADD `text_pending` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `submissions_text_pending_idx` ON `submissions` (`id`) WHERE "submissions"."text_pending" = 1;--> statement-breakpoint
CREATE INDEX `submission_texts_failed_idx` ON `submission_texts` (`updated_at`) WHERE "submission_texts"."error" is not null;