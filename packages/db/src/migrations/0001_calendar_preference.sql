CREATE TABLE `calendar_preference` (
	`user_id` text NOT NULL,
	`calendar_id` text NOT NULL,
	`visible` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `calendar_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
