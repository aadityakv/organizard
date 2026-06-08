CREATE TABLE `mutation_log` (
	`move_id` text NOT NULL,
	`client_id` text NOT NULL,
	`applied_at` integer NOT NULL,
	PRIMARY KEY(`move_id`, `client_id`),
	FOREIGN KEY (`move_id`) REFERENCES `moves`(`id`) ON UPDATE no action ON DELETE no action
);
