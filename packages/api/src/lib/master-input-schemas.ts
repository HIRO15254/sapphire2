import z from "zod";

export const memoSchema = z.string().max(50_000);
export const playerNameSchema = z.string().trim().min(1).max(100);
