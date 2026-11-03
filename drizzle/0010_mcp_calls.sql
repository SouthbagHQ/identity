CREATE TABLE `mcp_call` (
	`idempotency_key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tool` text NOT NULL,
	`args_hash` text NOT NULL DEFAULT '',
	`status` text NOT NULL DEFAULT 'pending',
	`response` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
