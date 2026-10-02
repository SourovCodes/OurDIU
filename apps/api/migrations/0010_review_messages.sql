CREATE TABLE `submission_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` integer NOT NULL,
	`author_id` text,
	`author_role` text NOT NULL,
	`kind` text NOT NULL,
	`body` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `submission_messages_submission_id_created_at_idx` ON `submission_messages` (`submission_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `submission_messages_author_id_idx` ON `submission_messages` (`author_id`);--> statement-breakpoint
ALTER TABLE `submissions` ADD `uploader_unread` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `admin_unread` integer DEFAULT 0 NOT NULL;