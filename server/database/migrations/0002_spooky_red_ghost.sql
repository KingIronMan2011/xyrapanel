CREATE TABLE `password_resets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_resets_user_id_index` ON `password_resets` (`user_id`);--> statement-breakpoint
CREATE INDEX `password_resets_token_index` ON `password_resets` (`token`);--> statement-breakpoint
ALTER TABLE `server_limits` ADD `memory_overallocate` integer;--> statement-breakpoint
ALTER TABLE `server_limits` ADD `disk_overallocate` integer;--> statement-breakpoint
ALTER TABLE `server_limits` ADD `database_limit` integer;--> statement-breakpoint
ALTER TABLE `server_limits` ADD `allocation_limit` integer;--> statement-breakpoint
ALTER TABLE `server_limits` ADD `backup_limit` integer;--> statement-breakpoint
ALTER TABLE `server_limits` DROP COLUMN `swap`;