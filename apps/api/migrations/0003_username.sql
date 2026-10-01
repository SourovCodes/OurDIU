ALTER TABLE `user` ADD `username` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
-- Every existing user gets a generated username, like new users at sign-up
-- (generateUsername in apps/api/src/lib/auth.ts). Legacy usernames are copied over separately.
UPDATE `user` SET `username` = 'user_' || lower(hex(randomblob(3))) WHERE `username` IS NULL;
