-- Normalize existing session_event rows to match the new invariants:
-- 1) occurred_at is stored at minute precision (seconds dropped)
-- 2) sort_order is a dense, session-scoped global index instead of a
--    per-(occurred_at) bucket counter. Before this migration multiple
--    events in the same session could share sort_order=0, which breaks
--    the new ORDER BY sort_order alone contract and caused event groups
--    (e.g. every update_stack at sort_order=0) to render out of order.

-- Step 1: floor occurred_at to the minute (epoch-second columns in D1).
UPDATE session_event
SET occurred_at = occurred_at - (occurred_at % 60);
--> statement-breakpoint

-- Step 2: reindex sort_order per session via ROW_NUMBER over
-- (occurred_at, sort_order, id) so the original chronology is preserved
-- but every row ends up with a unique sort_order within its session.
WITH renumbered AS (
	SELECT
		id,
		ROW_NUMBER() OVER (
			PARTITION BY session_id
			ORDER BY occurred_at ASC, sort_order ASC, id ASC
		) - 1 AS new_sort_order
	FROM session_event
)
UPDATE session_event
SET sort_order = (
	SELECT new_sort_order
	FROM renumbered
	WHERE renumbered.id = session_event.id
);
