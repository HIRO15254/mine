CREATE TABLE `project_rate` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`hourly_rate` integer NOT NULL,
	`effective_from` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_rate_project_day_idx` ON `project_rate` (`project_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `time_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text,
	`task_id` text,
	`description` text DEFAULT '' NOT NULL,
	`billable` integer DEFAULT true NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `time_entry_user_started_idx` ON `time_entry` (`user_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `time_entry_project_idx` ON `time_entry` (`project_id`);--> statement-breakpoint
CREATE INDEX `time_entry_task_idx` ON `time_entry` (`task_id`);