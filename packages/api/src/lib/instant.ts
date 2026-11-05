import z from "zod";

export const instantSchema = z.number().int().min(0);
