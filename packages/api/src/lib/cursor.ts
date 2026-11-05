import { TRPCError } from "@trpc/server";
import type z from "zod";

const BASE64_PADDING = /=+$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

export function encodeCursor(value: unknown): string {
	let binary = "";
	for (const byte of new TextEncoder().encode(JSON.stringify(value))) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(BASE64_PADDING, "");
}

export function decodeCursor<T>(cursor: string, schema: z.ZodType<T>): T {
	let value: unknown;
	try {
		if (!BASE64URL.test(cursor)) {
			throw new Error("Invalid cursor encoding");
		}
		const binary = atob(cursor.replaceAll("-", "+").replaceAll("_", "/"));
		value = JSON.parse(
			new TextDecoder("utf-8", { fatal: true }).decode(
				Uint8Array.from(binary, (char) => char.charCodeAt(0))
			)
		);
	} catch {
		value = undefined;
	}
	const parsed = schema.safeParse(value);
	if (!parsed.success) {
		throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid cursor" });
	}
	return parsed.data;
}
