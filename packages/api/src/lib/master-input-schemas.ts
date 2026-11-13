import z from "zod";

export const memoSchema = z.string().max(50_000);
export const playerNameSchema = z.string().trim().min(1).max(100);
export const iconNameSchema = z
	.string()
	.max(64)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
