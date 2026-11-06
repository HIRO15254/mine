CREATE TABLE `claude_thread` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`status` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`next_action` text DEFAULT '' NOT NULL,
	`project_id` text,
	`updated_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `claude_thread_user_idx` ON `claude_thread` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `claude_thread_url_idx` ON `claude_thread` (`user_id`,`url`);