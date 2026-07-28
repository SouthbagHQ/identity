CREATE TABLE `southbag_id_credential` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`face_id` text NOT NULL,
	`photo` text NOT NULL,
	`age` integer NOT NULL,
	`verdict` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `southbag_id_credential_face_id_unique` ON `southbag_id_credential` (`face_id`);--> statement-breakpoint
CREATE INDEX `southbag_id_credential_userId_idx` ON `southbag_id_credential` (`user_id`);