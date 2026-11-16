CREATE TABLE `email_outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipient_id` text NOT NULL,
	`kind` text NOT NULL,
	`submission_id` integer NOT NULL,
	`body` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`recipient_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `email_outbox_created_at_idx` ON `email_outbox` (`created_at`);--> statement-breakpoint
ALTER TABLE `user` ADD `email_notifications` integer DEFAULT true NOT NULL;