import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
	migrationFiles,
	migrationStatements,
	openDatabase,
	rowValues,
} from "./sqlite";

const migrationsDirectory = fileURLToPath(
	new URL("../migrations/", import.meta.url)
);

describe("seed restore (preview-deploy.yml, dev-deploy.yml)", () => {
	it("replays a production dump onto the complete migration history without deriving a second copy of any row", () => {
		const db = openDatabase();
		try {
			db.exec("PRAGMA foreign_keys=ON");
			for (const filename of migrationFiles()) {
				for (const statement of migrationStatements(
					readFileSync(join(migrationsDirectory, filename), "utf8")
				)) {
					db.exec(statement);
				}
			}

			db.exec("PRAGMA foreign_keys=OFF");
			db.exec(`
				INSERT INTO game_mix_variant (mix_id, variant_id, user_id, position) VALUES
					('mix-1', 'variant-1', 'user-1', 0),
					('mix-1', 'variant-2', 'user-1', 1);
				INSERT INTO game_mix (id, user_id, label, games, created_at, updated_at)
					VALUES ('mix-1', 'user-1', 'Mix', '[]', 0, 0);
				INSERT INTO game_variant (id, user_id, label, group_id, sort_order, created_at, updated_at) VALUES
					('variant-1', 'user-1', 'NLH', 'group-1', 0, 0, 0),
					('variant-2', 'user-1', 'PLO', 'group-1', 1, 0, 0);
				INSERT INTO game_group (id, user_id, label, created_at, updated_at)
					VALUES ('group-1', 'user-1', 'Holdem', 0, 0);
				INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
					VALUES ('user-1', 'U', 'u@example.com', 1, 0, 0);
			`);
			db.exec("PRAGMA foreign_keys=ON");

			expect(
				rowValues(
					db.prepare(
						"SELECT mix_id, variant_id, user_id, position FROM game_mix_variant ORDER BY position"
					)
				)
			).toEqual([
				["mix-1", "variant-1", "user-1", 0],
				["mix-1", "variant-2", "user-1", 1],
			]);
			expect(rowValues(db.prepare("PRAGMA foreign_key_check"))).toEqual([]);
		} finally {
			db.close();
		}
	});
});
