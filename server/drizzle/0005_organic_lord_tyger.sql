ALTER TABLE `moves` ADD `client_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `moves_owner_client` ON `moves` (`owner_id`,`client_id`);