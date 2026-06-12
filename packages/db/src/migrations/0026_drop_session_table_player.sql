-- Seated players are no longer persisted in a table.
--
-- session_table_player was a denormalized cache of the player_join /
-- player_leave event stream, and its seat_position was direct-mutated
-- without a corresponding event — so it could not be fully reconstructed
-- from events.
--
-- Seating is now derived entirely from events (computeSeatedPlayersFromEvents):
-- the player_join event payload carries the seat position, and a seat change
-- patches that join event's payload. The table is dropped with no backfill
-- (dev DB only).

DROP TABLE `session_table_player`;
