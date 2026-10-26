CREATE TABLE `course_aliases` (
	`course_id` integer NOT NULL,
	`alias` text NOT NULL,
	`source` text NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`course_id`, `alias`),
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `courses` ADD `aliases_checked_at` integer;