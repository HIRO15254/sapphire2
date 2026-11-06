CREATE TABLE `write_guard` (
	`name` text NOT NULL,
	CONSTRAINT "write_guard_failed" CHECK(0)
);
