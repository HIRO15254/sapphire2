import z from "zod";

export const instantSchema = z.number().int().min(0).max(8_640_000_000_000);
