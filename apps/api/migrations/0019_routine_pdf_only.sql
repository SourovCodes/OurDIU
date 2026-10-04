-- Routines come only from DIU's PDFs; teachers get contact details (phone, email, the
-- room where they sit). Course titles are no longer part of a version: admins keep
-- them in routine_courses.
ALTER TABLE `routine_teachers` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `routine_teachers` ADD `email` text;--> statement-breakpoint
ALTER TABLE `routine_teachers` ADD `room` text;--> statement-breakpoint
-- A version's file is DIU's PDF now (JSON uploads are gone): versions read from one
-- keep it as their file. Teachers a PDF listed become { name } objects.
UPDATE `routine_versions` SET `file_key` = `pdf_key` WHERE `pdf_key` IS NOT NULL;--> statement-breakpoint
UPDATE `routine_versions` SET `teachers` = (
  SELECT coalesce(json_group_object(`key`, json_object('name', `value`)), '{}')
  FROM json_each(`routine_versions`.`teachers`) WHERE `type` = 'text'
) WHERE `teachers` != '{}';--> statement-breakpoint
ALTER TABLE `routine_versions` DROP COLUMN `pdf_key`;--> statement-breakpoint
ALTER TABLE `routine_versions` DROP COLUMN `courses`;