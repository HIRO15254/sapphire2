import { schema } from "@sapphire2/db/schema";
import { is } from "drizzle-orm";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect } from "vitest";
import { test } from "./test-fixture";

interface SqlColumn {
	name: string;
	notnull: number;
	pk: number;
	type: string;
}

interface SqlForeignKey {
	from: string;
	id: number;
	on_delete: string;
	table: string;
	to: string;
}

interface ForeignKeyShape {
	from: string[];
	on_delete: string;
	table: string;
	to: string[];
}

function sortedForeignKeys(foreignKeys: ForeignKeyShape[]) {
	return [...foreignKeys].sort((a, b) =>
		JSON.stringify(a).localeCompare(JSON.stringify(b))
	);
}

interface SqlIndex {
	name: string;
	origin: string;
	unique: number;
}

type DeclaredIndex = ReturnType<
	typeof getTableConfig
>["indexes"][number]["config"];

const INDEX_EXPRESSIONS: Record<string, string> = {
	ledger_category_user_name_unique: 'lower("name")',
};

function declaredIndexColumns(index: DeclaredIndex) {
	return index.columns.map((column) => {
		if ("name" in column) {
			return column.name;
		}
		const expression = INDEX_EXPRESSIONS[index.name];
		if (!expression) {
			throw new Error(`Add a SQL expression contract for index ${index.name}`);
		}
		return expression;
	});
}

describe("application schema agrees with the installed production migrations", () => {
	test("all declared columns, primary and unique keys, foreign keys and indexes exist in real D1", async ({
		api,
	}) => {
		for (const value of Object.values(schema)) {
			if (!is(value, SQLiteTable)) {
				continue;
			}
			const config = getTableConfig(value);
			const columns = await api.d1
				.prepare("SELECT name, type, [notnull], pk FROM pragma_table_info(?)")
				.bind(config.name)
				.all<SqlColumn>();
			expect(
				columns.results.map(({ name }) => name).sort(),
				`${config.name} column set`
			).toEqual(config.columns.map(({ name }) => name).sort());
			for (const column of config.columns) {
				expect(
					columns.results.find(({ name }) => name === column.name),
					`${config.name}.${column.name}`
				).toMatchObject({
					name: column.name,
					type: column.getSQLType().toUpperCase(),
					notnull: Number(column.notNull),
				});
			}
			const primary = config.primaryKeys.flatMap(({ columns: keyColumns }) =>
				keyColumns.map(({ name }) => name)
			);
			primary.push(
				...config.columns
					.filter(({ primary }) => primary)
					.map(({ name }) => name)
			);
			expect(
				columns.results
					.filter(({ pk }) => pk > 0)
					.sort((a, b) => a.pk - b.pk)
					.map(({ name }) => name),
				`${config.name} primary key`
			).toEqual(primary);
			const foreignKeyColumns = await api.d1
				.prepare(
					"SELECT id, [from], [to], [table], on_delete FROM pragma_foreign_key_list(?) ORDER BY id, seq"
				)
				.bind(config.name)
				.all<SqlForeignKey>();
			const installedForeignKeys = new Map<number, ForeignKeyShape>();
			for (const column of foreignKeyColumns.results) {
				const foreignKey = installedForeignKeys.get(column.id) ?? {
					from: [],
					on_delete: column.on_delete,
					table: column.table,
					to: [],
				};
				foreignKey.from.push(column.from);
				foreignKey.to.push(column.to);
				installedForeignKeys.set(column.id, foreignKey);
			}
			const expectedForeignKeys = config.foreignKeys.map((foreignKey) => {
				const reference = foreignKey.reference();
				return {
					from: reference.columns.map(({ name }) => name),
					on_delete: (foreignKey.onDelete ?? "no action").toUpperCase(),
					table: getTableConfig(reference.foreignTable).name,
					to: reference.foreignColumns.map(({ name }) => name),
				};
			});
			expect(
				sortedForeignKeys([...installedForeignKeys.values()]),
				`${config.name} foreign keys with column order and on_delete`
			).toEqual(sortedForeignKeys(expectedForeignKeys));
			const indexes = await api.d1
				.prepare("SELECT name, origin, [unique] FROM pragma_index_list(?)")
				.bind(config.name)
				.all<SqlIndex>();
			const installedIndexColumns = new Map<string, string[]>();
			for (const index of indexes.results) {
				const columns = await api.d1
					.prepare("SELECT name FROM pragma_index_info(?) ORDER BY seqno")
					.bind(index.name)
					.all<{ name: string | null }>();
				const definition = await api.d1
					.prepare(
						"SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?"
					)
					.bind(index.name)
					.first<{ sql: string | null }>();
				const expression = INDEX_EXPRESSIONS[index.name];
				installedIndexColumns.set(
					index.name,
					columns.results.map(({ name }) => {
						if (name !== null) {
							return name;
						}
						return expression && definition?.sql?.includes(expression)
							? expression
							: `expression not in contract: ${definition?.sql}`;
					})
				);
			}
			for (const { config: index } of config.indexes) {
				expect(indexes.results, `${config.name}.${index.name}`).toContainEqual(
					expect.objectContaining({
						name: index.name,
						unique: Number(index.unique),
					})
				);
				expect(
					installedIndexColumns.get(index.name),
					`${index.name} column order`
				).toEqual(declaredIndexColumns(index));
			}

			const uniqueKeys = [
				...config.columns
					.filter(({ isUnique }) => isUnique)
					.map(({ name }) => [name]),
				...config.uniqueConstraints.map(({ columns }) =>
					columns.map(({ name }) => name)
				),
				...config.indexes
					.filter(({ config: index }) => index.unique)
					.map(({ config: index }) => declaredIndexColumns(index)),
			];
			expect(
				indexes.results
					.filter(({ origin, unique }) => unique === 1 && origin !== "pk")
					.map(({ name }) => JSON.stringify(installedIndexColumns.get(name)))
					.sort(),
				`${config.name} unique keys including column-level declarations`
			).toEqual(uniqueKeys.map((columns) => JSON.stringify(columns)).sort());
		}
	});
});
