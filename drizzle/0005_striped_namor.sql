PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_southbag_id_credential` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`face_id` text NOT NULL,
	`photo` text NOT NULL,
	`date_of_birth` text NOT NULL,
	`verdict` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_southbag_id_credential`("id", "user_id", "face_id", "photo", "date_of_birth", "verdict", "created_at", "updated_at") SELECT "id", "user_id", "face_id", "photo", date("created_at" / 1000, 'unixepoch', '-' || "age" || ' years'), "verdict", "created_at", "updated_at" FROM `southbag_id_credential`;--> statement-breakpoint
DROP TABLE `southbag_id_credential`;--> statement-breakpoint
ALTER TABLE `__new_southbag_id_credential` RENAME TO `southbag_id_credential`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `southbag_id_credential_face_id_unique` ON `southbag_id_credential` (`face_id`);--> statement-breakpoint
CREATE INDEX `southbag_id_credential_userId_idx` ON `southbag_id_credential` (`user_id`);
