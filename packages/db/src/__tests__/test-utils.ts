import { is, SQL } from "drizzle-orm";
import {
	getTableConfig,
	SQLiteSyncDialect,
	type SQLiteTable,
} from "drizzle-orm/sqlite-core";

const dialect = new SQLiteSyncDialect();

export interface ForeignKeyContract {
	columns: string[];
	foreignColumns: string[];
	foreignTable: string;
	onDelete: string | undefined;
}

export interface IndexContract {
	columns: string[];
	name: string;
	unique: boolean;
	where: string | null;
}

export interface CheckContract {
	name: string;
	sql: string;
}

export function tableNameOf(table: SQLiteTable): string {
	return getTableConfig(table).name;
}

export function foreignKeysOf(table: SQLiteTable): ForeignKeyContract[] {
	return getTableConfig(table).foreignKeys.map((fk) => {
		const reference = fk.reference();
		return {
			columns: reference.columns.map((column) => column.name),
			foreignColumns: reference.foreignColumns.map((column) => column.name),
			foreignTable: getTableConfig(reference.foreignTable).name,
			onDelete: fk.onDelete,
		};
	});
}

export function fkByColumn(
	table: SQLiteTable,
	columnName: string
): ForeignKeyContract | undefined {
	return foreignKeysOf(table).find((fk) => fk.columns.includes(columnName));
}

export function indexesOf(table: SQLiteTable): IndexContract[] {
	return getTableConfig(table).indexes.map((index) => ({
		columns: index.config.columns.map((column) =>
			is(column, SQL) ? dialect.sqlToQuery(column).sql : column.name
		),
		name: index.config.name,
		unique: index.config.unique,
		where: index.config.where
			? dialect.sqlToQuery(index.config.where).sql
			: null,
	}));
}

export function indexByName(
	table: SQLiteTable,
	name: string
): IndexContract | undefined {
	return indexesOf(table).find((index) => index.name === name);
}

export function indexNamesOf(table: SQLiteTable): string[] {
	return indexesOf(table).map((index) => index.name);
}

export function uniqueIndexesOf(table: SQLiteTable): IndexContract[] {
	return indexesOf(table).filter((index) => index.unique);
}

export function checksOf(table: SQLiteTable): CheckContract[] {
	return getTableConfig(table).checks.map((check) => ({
		name: check.name,
		sql: dialect.sqlToQuery(check.value).sql,
	}));
}
