CREATE TABLE `submission_analyses` (
	`submission_id` integer PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`auto_publish` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`error` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`model` text,
	`original_bytes` integer,
	`sent_bytes` integer,
	`is_question_paper` integer,
	`paper_count` integer,
	`note` text,
	`department_id` integer,
	`department_name` text,
	`department_short_name` text,
	`course_id` integer,
	`course_name` text,
	`semester_id` integer,
	`semester_name` text,
	`exam_type_id` integer,
	`exam_type_name` text,
	`section` text,
	`batch` text,
	`raw_response` text,
	`completed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`exam_type_id`) REFERENCES `exam_types`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `submission_analyses_status_idx` ON `submission_analyses` (`status`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `submission_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` integer NOT NULL,
	`reporter_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reporter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submission_reports_open_unique` ON `submission_reports` (`submission_id`,`reporter_id`) WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX `submission_reports_submission_id_status_idx` ON `submission_reports` (`submission_id`,`status`);--> statement-breakpoint
CREATE INDEX `submission_reports_reporter_id_idx` ON `submission_reports` (`reporter_id`);--> statement-breakpoint
CREATE TABLE `submission_votes` (
	`submission_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`value` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`submission_id`, `user_id`),
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "submission_votes_value_check" CHECK("submission_votes"."value" in (1, -1))
);
--> statement-breakpoint
CREATE INDEX `submission_votes_user_id_idx` ON `submission_votes` (`user_id`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`department_id` integer NOT NULL,
	`course_id` integer NOT NULL,
	`semester_id` integer NOT NULL,
	`exam_type_id` integer NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exam_type_id`) REFERENCES `exam_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_id`,`department_id`) REFERENCES `courses`(`id`,`department_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `questions_department_id_idx` ON `questions` (`department_id`);--> statement-breakpoint
CREATE INDEX `questions_semester_id_idx` ON `questions` (`semester_id`);--> statement-breakpoint
CREATE INDEX `questions_exam_type_id_idx` ON `questions` (`exam_type_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `questions_course_semester_exam_type_unique` ON `questions` (`course_id`,`semester_id`,`exam_type_id`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question_id` integer,
	`department_id` integer,
	`custom_department_name` text,
	`custom_department_short_name` text,
	`course_id` integer,
	`custom_course_name` text,
	`semester_id` integer,
	`custom_semester_name` text,
	`exam_type_id` integer,
	`section` text,
	`batch` text,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`auto_published_at` integer,
	`file_key` text NOT NULL,
	`file_size` integer NOT NULL,
	`watermarked_file_key` text,
	`watermarked_file_size` integer,
	`watermark_status` text,
	`watermark_error` text,
	`uploader_id` text,
	`like_count` integer DEFAULT 0 NOT NULL,
	`dislike_count` integer DEFAULT 0 NOT NULL,
	`pending_report_count` integer DEFAULT 0 NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`semester_id`) REFERENCES `semesters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exam_type_id`) REFERENCES `exam_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploader_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`course_id`,`department_id`) REFERENCES `courses`(`id`,`department_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "submissions_classification_check" CHECK((
        question_id IS NOT NULL
        AND department_id IS NULL AND custom_department_name IS NULL AND custom_department_short_name IS NULL
        AND course_id IS NULL AND custom_course_name IS NULL
        AND semester_id IS NULL AND custom_semester_name IS NULL
        AND exam_type_id IS NULL
      ) OR (
        question_id IS NULL
        AND exam_type_id IS NOT NULL
        AND (department_id IS NULL) <> (custom_department_name IS NULL)
        AND (course_id IS NULL) <> (custom_course_name IS NULL)
        AND (semester_id IS NULL) <> (custom_semester_name IS NULL)
        AND (custom_department_short_name IS NULL OR custom_department_name IS NOT NULL)
        AND (course_id IS NULL OR department_id IS NOT NULL)
      ))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_fileKey_unique` ON `submissions` (`file_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_watermarkedFileKey_unique` ON `submissions` (`watermarked_file_key`);--> statement-breakpoint
CREATE INDEX `submissions_question_id_status_idx` ON `submissions` (`question_id`,`status`);--> statement-breakpoint
CREATE INDEX `submissions_uploader_id_idx` ON `submissions` (`uploader_id`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`department_id` integer NOT NULL,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courses_department_id_name_unique` ON `courses` (`department_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `courses_id_department_id_unique` ON `courses` (`id`,`department_id`);--> statement-breakpoint
CREATE TABLE `departments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `departments_name_unique` ON `departments` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `departments_shortName_unique` ON `departments` (`short_name`);--> statement-breakpoint
CREATE TABLE `exam_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exam_types_name_unique` ON `exam_types` (`name`);--> statement-breakpoint
CREATE TABLE `semesters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `semesters_name_unique` ON `semesters` (`name`);