# seed-from-export (temporary)

Phase 0 で DB schema を全書き換えしたため、本番 D1 の export をローカル D1 にそのまま流せなくなりました。
この一時スクリプトは、旧 schema の D1 export (`.sql`) を読み、新 schema 用の `INSERT` を吐き出します。

> **Note**: PR が merge されて本番が新 schema に切り替わるまでの一時的なツールです。切替後はこのディレクトリごと削除してください。

## 手順

```sh
# 1. 本番から export
bun x wrangler d1 export sapphire2-db --remote \
  -c apps/server/wrangler.toml \
  --output prod-export.sql

# 2. 旧 → 新 schema の SQL に変換 (出力は同じディレクトリの seed-local.sql)
bun run seed:from-export prod-export.sql

# 3. ローカル D1 を migrate (空にしておく)
bun run db:migrate:local

# 4. 変換 SQL を流し込み
bun x wrangler d1 execute sapphire2-db --local \
  -c apps/server/wrangler.toml \
  --file=seed-local.sql
```

## 何を変換しているか

| 旧テーブル | 新テーブル | 変換 |
|---|---|---|
| `user`, `account`, `session` (auth), `verification` | 同 | pass-through |
| `store`, `currency`, `transaction_type`, `currency_transaction` | 同 | pass-through |
| `player`, `player_tag`, `player_to_player_tag` | 同 | pass-through |
| `session_tag`, `session_to_session_tag` | 同 | pass-through |
| `tournament_tag`, `dashboard_widget`, `update_note_view` | 同 | pass-through |
| `tournament` (`variant: text`) | `tournament` (`variant_id: int`) | `variant` 文字列 → master `variant.id` |
| `ring_game` (`variant`, `blind1..3`, `ante`, `ante_type`) | `ring_game` + `ring_game_blind_set` | variant 分解 + blind set 1 件生成 |
| `blind_level` | `tournament_blind_level` | level + sort_order だけ移行 |
| `game_session` | 同 | pass-through |
| `session_cash_detail` | 同 (+ `rule_name`, `variant_id`) | `rule_name = 'Imported'` で埋め |
| `session_tournament_detail` | 同 (+ `rule_name`, `variant_id`, `buy_in`/`entry_fee` NOT NULL) | 同上 |
| `session_event` | 同 | pass-through (payload 構造変化があれば手動調整) |

## 既知の TODO

`transform.ts` の `// TODO(seed):` 参照。

- **`tournament_blind_set`**: 旧 `blind_level` の `blind1/2/3` を新 `tournament_blind_set` に展開する処理。新 `tournament_blind_level.id` が autoincrement なので、SQL ファイル単独では参照できません。`SELECT last_insert_rowid()` を毎行挟むか、Drizzle 直書きに置き換える必要があります。
- **`session_table_player` → `session_event`**: 旧 `session_table_player` 各行を `session_event(add_player)` および `session_event(remove_player)` に projecting する処理。
- **`session_event.payload`**: 旧と新で payload のキー構造が変わっている場合、`transform.ts` の `emitSessionEvents` を payload-aware な変換に拡張してください。

## 入力 SQL の前提

`wrangler d1 export` は `sqlite_master` の `CREATE TABLE` も含むので、変換スクリプト内部の `:memory:` DB で旧 schema が再構築されることを前提にしています。dump が PRAGMA や外部キー制約で詰まる場合は `index.ts` の `tmpDb.exec(sql)` の前で対応してください。
