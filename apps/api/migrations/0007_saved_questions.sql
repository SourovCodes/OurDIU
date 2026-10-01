CREATE TABLE `saved_questions` (
	`user_id` text NOT NULL,
	`question_id` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `question_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `saved_questions_user_id_created_at_idx` ON `saved_questions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `saved_questions_question_id_idx` ON `saved_questions` (`question_id`);