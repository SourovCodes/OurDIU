DROP INDEX `questions_department_id_idx`;--> statement-breakpoint
ALTER TABLE `questions` ADD `published_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `pending_review_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `rejected_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `latest_published_at` integer;--> statement-breakpoint
CREATE INDEX `questions_latest_published_at_idx` ON `questions` (`latest_published_at`);--> statement-breakpoint
CREATE INDEX `questions_view_count_idx` ON `questions` (`view_count`);--> statement-breakpoint
CREATE INDEX `questions_department_id_latest_published_at_idx` ON `questions` (`department_id`,`latest_published_at`);--> statement-breakpoint
CREATE INDEX `questions_department_id_view_count_idx` ON `questions` (`department_id`,`view_count`);--> statement-breakpoint
DROP INDEX `submissions_question_id_status_idx`;--> statement-breakpoint
CREATE INDEX `submissions_question_id_status_created_at_idx` ON `submissions` (`question_id`,`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `user` ADD `published_submission_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `published_view_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `user_published_submission_count_name_idx` ON `user` (`published_submission_count`,`name`);--> statement-breakpoint
ALTER TABLE `departments` ADD `published_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `courses_name_department_id_idx` ON `courses` (`name`,`department_id`);