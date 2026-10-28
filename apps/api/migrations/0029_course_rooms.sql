CREATE TABLE `room_bans` (
	`user_id` text PRIMARY KEY NOT NULL,
	`banned_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`banned_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `room_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`reporter_id` text NOT NULL,
	`reported_user_id` text NOT NULL,
	`reason` text NOT NULL,
	`message` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reporter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reported_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `room_reports_status_idx` ON `room_reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `room_reports_reported_user_id_idx` ON `room_reports` (`reported_user_id`);--> statement-breakpoint
CREATE INDEX `room_reports_reporter_id_idx` ON `room_reports` (`reporter_id`);--> statement-breakpoint
CREATE INDEX `room_reports_course_id_idx` ON `room_reports` (`course_id`);--> statement-breakpoint
CREATE TABLE `room_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`paused` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "room_settings_single_row" CHECK("room_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `room_usage` (
	`cycle` text PRIMARY KEY NOT NULL,
	`voice_bytes` integer DEFAULT 0 NOT NULL,
	`voice_seconds` integer DEFAULT 0 NOT NULL,
	`messages` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
