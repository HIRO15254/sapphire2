-- Replace the `type` discriminator on `chips_add_remove` events with a
-- signed `amount`. Previously the payload was `{ amount, type }` where
-- `type ∈ {"add","remove"}` and `amount` was always non-negative. Going
-- forward the payload is `{ amount }` where positive means add and
-- negative means remove.
--
-- Migration:
--   1. For payloads with `type = "remove"`, negate the amount.
--   2. Strip the `type` key from every chips_add_remove payload.

UPDATE session_event
SET
    payload = json_set(
        payload,
        '$.amount',
        -json_extract(payload, '$.amount')
    ),
    updated_at = unixepoch()
WHERE event_type = 'chips_add_remove'
  AND json_extract(payload, '$.type') = 'remove';
--> statement-breakpoint

UPDATE session_event
SET
    payload = json_remove(payload, '$.type'),
    updated_at = unixepoch()
WHERE event_type = 'chips_add_remove'
  AND json_extract(payload, '$.type') IS NOT NULL;
