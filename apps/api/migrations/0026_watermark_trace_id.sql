ALTER TABLE `submissions` ADD `watermark_trace_id` text;--> statement-breakpoint
CREATE INDEX `submissions_watermark_trace_id_idx` ON `submissions` (`watermark_trace_id`);