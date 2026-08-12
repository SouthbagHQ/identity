CREATE TABLE `southbag_id_wallet_pass` (
	`user_id` text PRIMARY KEY NOT NULL,
	`share_url` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
