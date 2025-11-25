CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`page_number` integer NOT NULL,
	`page_count` integer NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer NOT NULL,
	`file_hash` text NOT NULL,
	`width` integer,
	`height` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plans_project_page_idx` ON `plans` (`project_id`,`page_number`);--> statement-breakpoint
CREATE INDEX `plans_file_hash_idx` ON `plans` (`file_hash`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text,
	`icon_key` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_project_name_idx` ON `devices` (`project_id`,`name`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`bounds` blob,
	`color` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `locations_plan_idx` ON `locations` (`plan_id`);--> statement-breakpoint
CREATE TABLE `location_vertices` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `location_vertices_location_seq_idx` ON `location_vertices` (`location_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `stamps` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`device_id` text NOT NULL,
	`location_id` text,
	`position` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `stamps_aggregation_idx` ON `stamps` (`plan_id`,`device_id`,`location_id`);--> statement-breakpoint
CREATE INDEX `stamps_plan_idx` ON `stamps` (`plan_id`);--> statement-breakpoint
CREATE INDEX `stamps_device_idx` ON `stamps` (`device_id`);--> statement-breakpoint
CREATE TABLE `stamp_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`stamp_id` text NOT NULL,
	`type` text NOT NULL,
	`snapshot` blob,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`stamp_id`) REFERENCES `stamps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `stamp_revisions_stamp_created_idx` ON `stamp_revisions` (`stamp_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `exports` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`format` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer NOT NULL,
	`include_locations` integer DEFAULT 0 NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `exports_project_idx` ON `exports` (`project_id`);--> statement-breakpoint
CREATE INDEX `exports_expires_idx` ON `exports` (`expires_at`);
