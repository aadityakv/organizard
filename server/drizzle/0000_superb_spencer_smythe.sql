CREATE TABLE `box_markers` (
	`box_id` text NOT NULL,
	`marker_id` text NOT NULL,
	PRIMARY KEY(`box_id`, `marker_id`),
	FOREIGN KEY (`box_id`) REFERENCES `boxes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`marker_id`) REFERENCES `markers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `boxes` (
	`id` text PRIMARY KEY NOT NULL,
	`move_id` text NOT NULL,
	`room_id` text NOT NULL,
	`number` integer NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'green' NOT NULL,
	`status_id` text NOT NULL,
	`cover_photo_id` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`move_id`) REFERENCES `moves`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`move_id` text NOT NULL,
	`role` text NOT NULL,
	`token` text NOT NULL,
	`created_by` text NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_by` text,
	FOREIGN KEY (`move_id`) REFERENCES `moves`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_token_unique` ON `invites` (`token`);--> statement-breakpoint
CREATE TABLE `item_markers` (
	`item_id` text NOT NULL,
	`marker_id` text NOT NULL,
	PRIMARY KEY(`item_id`, `marker_id`),
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`marker_id`) REFERENCES `markers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`move_id` text NOT NULL,
	`box_id` text NOT NULL,
	`name` text NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`value_cents` integer DEFAULT 0 NOT NULL,
	`note` text,
	`icon` text,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`move_id`) REFERENCES `moves`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`box_id`) REFERENCES `boxes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `markers` (
	`id` text PRIMARY KEY NOT NULL,
	`move_id` text NOT NULL,
	`label` text NOT NULL,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`custom` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`move_id`) REFERENCES `moves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`move_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`move_id`) REFERENCES `moves`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_move_user` ON `members` (`move_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `moves` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`from_addr` text,
	`to_addr` text,
	`target_date` text,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`move_id` text NOT NULL,
	`item_id` text,
	`box_id` text,
	`r2_key` text NOT NULL,
	`width` integer,
	`height` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`move_id`) REFERENCES `moves`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`move_id` text NOT NULL,
	`name` text NOT NULL,
	`dest` text,
	`icon` text DEFAULT 'box' NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`move_id`) REFERENCES `moves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `statuses` (
	`id` text PRIMARY KEY NOT NULL,
	`move_id` text NOT NULL,
	`label` text NOT NULL,
	`color` text NOT NULL,
	`custom` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`move_id`) REFERENCES `moves`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`apple_sub` text,
	`email` text,
	`name` text NOT NULL,
	`avatar_color` text DEFAULT 'green' NOT NULL,
	`entitlement_active` integer DEFAULT false NOT NULL,
	`entitlement_expires_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_apple_sub_unique` ON `users` (`apple_sub`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);