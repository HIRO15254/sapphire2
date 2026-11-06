> Historical snapshot. Current guidance: [game-masters](../design/game-masters.md).

# Game Master Data

The data-model cutover retired frozen labels and the mixed-game sentinel in favor of id-based lineups. Migration `0067_ring_game_rule_versions.sql` seeded the complete default game set for owners with legacy ring games but no game masters before creating stand-ins. Migration 0075 dropped the retired `game_mix.games` column.
