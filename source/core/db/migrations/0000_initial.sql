CREATE TABLE `app_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`selected_model_id` text,
	`theme_mode` text DEFAULT 'system' NOT NULL,
	`theme_color` text DEFAULT 'monochrome' NOT NULL,
	`onboarding_done` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`selected_model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "app_state_single_row" CHECK("app_state"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`kind` text DEFAULT 'image' NOT NULL,
	`rel_path` text NOT NULL,
	`mime_type` text,
	`width` integer,
	`height` integer,
	`size_bytes` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attachments_message_idx` ON `attachments` (`message_id`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`model_id` text,
	`system_prompt` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `conversations_updated_at_idx` ON `conversations` (`updated_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`error` text,
	`model_id` text,
	`model_name` text,
	`tokens_predicted` integer,
	`tokens_evaluated` integer,
	`tokens_per_second` real,
	`ms_to_first_token` integer,
	`total_ms` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_conversation_idx` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `model_settings` (
	`model_id` text PRIMARY KEY NOT NULL,
	`system_prompt` text,
	`temperature` real,
	`top_p` real,
	`top_k` integer,
	`repeat_penalty` real,
	`n_predict` integer,
	`n_ctx` integer,
	`n_gpu_layers` integer,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `models` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`repo` text NOT NULL,
	`filename` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`rel_path` text NOT NULL,
	`mmproj_filename` text,
	`mmproj_size_bytes` integer,
	`mmproj_rel_path` text,
	`architecture` text,
	`param_count` integer,
	`context_length` integer,
	`quant` text,
	`downloaded_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `models_downloaded_at_idx` ON `models` (`downloaded_at`);