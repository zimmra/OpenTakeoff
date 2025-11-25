-- Migration: Add counts table and triggers for real-time count aggregation
-- This migration adds:
-- 1. counts table for materialized view of stamp aggregations
-- 2. Triggers on stamps table to automatically maintain counts

-- Create counts table
CREATE TABLE `counts` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`device_id` text NOT NULL,
	`location_id` text,
	`total` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `counts_plan_device_location_idx` ON `counts` (`plan_id`,`device_id`,`location_id`);--> statement-breakpoint
CREATE INDEX `counts_plan_idx` ON `counts` (`plan_id`);--> statement-breakpoint
CREATE TRIGGER stamp_insert_count AFTER INSERT ON stamps BEGIN
  INSERT INTO counts(id, plan_id, device_id, location_id, total, updated_at)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.plan_id,
    NEW.device_id,
    NEW.location_id,
    1,
    unixepoch()
  )
  ON CONFLICT(plan_id, device_id, location_id) DO UPDATE SET
    total = total + 1,
    updated_at = unixepoch();
END;
--> statement-breakpoint
CREATE TRIGGER stamp_update_count AFTER UPDATE ON stamps
WHEN OLD.location_id IS NOT NEW.location_id BEGIN
  -- Decrement count at old location
  UPDATE counts
  SET total = total - 1, updated_at = unixepoch()
  WHERE plan_id = OLD.plan_id
    AND device_id = OLD.device_id
    AND location_id IS OLD.location_id;

  -- Delete count row if it reaches zero
  DELETE FROM counts
  WHERE plan_id = OLD.plan_id
    AND device_id = OLD.device_id
    AND location_id IS OLD.location_id
    AND total <= 0;

  -- Increment count at new location
  INSERT INTO counts(id, plan_id, device_id, location_id, total, updated_at)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.plan_id,
    NEW.device_id,
    NEW.location_id,
    1,
    unixepoch()
  )
  ON CONFLICT(plan_id, device_id, location_id) DO UPDATE SET
    total = total + 1,
    updated_at = unixepoch();
END;
--> statement-breakpoint
CREATE TRIGGER stamp_delete_count AFTER DELETE ON stamps BEGIN
  UPDATE counts
  SET total = total - 1, updated_at = unixepoch()
  WHERE plan_id = OLD.plan_id
    AND device_id = OLD.device_id
    AND location_id IS OLD.location_id;

  -- Delete count row if it reaches zero
  DELETE FROM counts
  WHERE plan_id = OLD.plan_id
    AND device_id = OLD.device_id
    AND location_id IS OLD.location_id
    AND total <= 0;
END;
