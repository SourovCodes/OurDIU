CREATE TABLE `routine_classes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`version_id` integer NOT NULL,
	`day` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`course` text NOT NULL,
	`section` text NOT NULL,
	`lab_group` text,
	`room` text NOT NULL,
	`room_type` text,
	`teacher` text,
	FOREIGN KEY (`version_id`) REFERENCES `routine_versions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `routine_classes_version_id_section_idx` ON `routine_classes` (`version_id`,`section`);--> statement-breakpoint
CREATE TABLE `routine_courses` (
	`code` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `routine_teachers` (
	`initials` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `routine_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`department` text NOT NULL,
	`version` text NOT NULL,
	`published_on` text,
	`source` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`file_key` text NOT NULL,
	`slots` text NOT NULL,
	`courses` text DEFAULT '{}' NOT NULL,
	`teachers` text DEFAULT '{}' NOT NULL,
	`warnings` text DEFAULT '[]' NOT NULL,
	`section_count` integer NOT NULL,
	`class_count` integer NOT NULL,
	`uploaded_by` text,
	`live_at` integer,
	`replaced_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routine_versions_department_version_idx` ON `routine_versions` (`department`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `routine_versions_live_idx` ON `routine_versions` (`department`) WHERE "routine_versions"."status" = 'live';--> statement-breakpoint
CREATE INDEX `routine_versions_uploaded_by_idx` ON `routine_versions` (`uploaded_by`);