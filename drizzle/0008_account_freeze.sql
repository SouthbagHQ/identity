CREATE TABLE `freeze_charge` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`description` text NOT NULL,
	`status` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `freeze_charge_userId_idx` ON `freeze_charge` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `freeze_charge_charged_key` ON `freeze_charge` (`idempotency_key`) WHERE status = 'charged';--> statement-breakpoint
CREATE TABLE `freeze_event` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text,
	`origin` text NOT NULL,
	`actor` text NOT NULL,
	`synced` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `freeze_event_userId_idx` ON `freeze_event` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `user` ADD `frozen` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `frozen_reason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `frozen_at` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `security_question` text;--> statement-breakpoint
ALTER TABLE `user` ADD `security_streak` integer DEFAULT 0 NOT NULL;