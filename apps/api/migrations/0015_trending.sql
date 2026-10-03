CREATE TABLE `question_view_hours` (
	`question_id` integer NOT NULL,
	`hour` integer NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`question_id`, `hour`),
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `question_view_hours_hour_idx` ON `question_view_hours` (`hour`);--> statement-breakpoint
CREATE TABLE `trending_questions` (
	`question_id` integer PRIMARY KEY NOT NULL,
	`views` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trending_questions_views_idx` ON `trending_questions` (`views`);