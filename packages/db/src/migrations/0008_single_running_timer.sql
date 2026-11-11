-- Keep only the newest running entry per user; older ones end where it starts.
UPDATE `time_entry`
SET `ended_at` = (
	SELECT max(`other`.`started_at`)
	FROM `time_entry` AS `other`
	WHERE `other`.`user_id` = `time_entry`.`user_id` AND `other`.`ended_at` IS NULL
)
WHERE `ended_at` IS NULL
	AND `id` <> (
		SELECT `newest`.`id`
		FROM `time_entry` AS `newest`
		WHERE `newest`.`user_id` = `time_entry`.`user_id` AND `newest`.`ended_at` IS NULL
		ORDER BY `newest`.`started_at` DESC, `newest`.`id` DESC
		LIMIT 1
	);
--> statement-breakpoint
CREATE UNIQUE INDEX `time_entry_running_idx` ON `time_entry` (`user_id`) WHERE "time_entry"."ended_at" is null;
