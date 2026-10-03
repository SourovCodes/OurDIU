CREATE TABLE `merged_ids` (
	`kind` text NOT NULL,
	`old_id` integer NOT NULL,
	`new_id` integer NOT NULL,
	`merged_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`kind`, `old_id`)
);
--> statement-breakpoint
CREATE INDEX `merged_ids_kind_new_id_idx` ON `merged_ids` (`kind`,`new_id`);