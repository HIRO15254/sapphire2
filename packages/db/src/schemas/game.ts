import z from "zod";
import { ANTE_TYPES } from "../constants/rule";

export const MAX_MIX_GROUPS = 12;

export const anteTypeSchema = z.enum(ANTE_TYPES);
