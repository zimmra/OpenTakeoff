CREATE TABLE `location_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`type` text NOT NULL,
	`snapshot` blob,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `location_revisions_location_created_idx` ON `location_revisions` (`location_id`,`created_at`);
