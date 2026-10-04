-- Course titles and teachers' names are per department (EEE's initials overlap CSE's); the
-- rows so far are all CSE's. Versions read from DIU's PDF keep it (pdf_key).

PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_routine_courses` (
	`department` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`department`, `code`)
);
--> statement-breakpoint
INSERT INTO `__new_routine_courses`("department", "code", "title", "updated_at") SELECT 'CSE', "code", "title", "updated_at" FROM `routine_courses`;--> statement-breakpoint
DROP TABLE `routine_courses`;--> statement-breakpoint
ALTER TABLE `__new_routine_courses` RENAME TO `routine_courses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_routine_teachers` (
	`department` text NOT NULL,
	`initials` text NOT NULL,
	`name` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`department`, `initials`)
);
--> statement-breakpoint
INSERT INTO `__new_routine_teachers`("department", "initials", "name", "updated_at") SELECT 'CSE', "initials", "name", "updated_at" FROM `routine_teachers`;--> statement-breakpoint
DROP TABLE `routine_teachers`;--> statement-breakpoint
ALTER TABLE `__new_routine_teachers` RENAME TO `routine_teachers`;--> statement-breakpoint
ALTER TABLE `routine_versions` ADD `pdf_key` text;