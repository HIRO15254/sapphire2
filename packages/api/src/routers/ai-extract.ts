import { TRPCError } from "@trpc/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type {
	ResponseInput,
	ResponseInputContent,
} from "openai/resources/responses/responses";
import z from "zod";
import { AI_MODELS, EXTRACTION_MAX_OUTPUT_TOKENS } from "../ai/models";
import { protectedProcedure, router } from "../index";
import {
	TABLE_PLAYER_SOURCE_APP_IDS,
	TABLE_PLAYER_SOURCE_APPS,
} from "./ai-extract-sources";

const MEDIA_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
] as const;

const SourceSchema = z.object({
	kind: z.literal("image"),
	data: z.string().min(1),
	mediaType: z.enum(MEDIA_TYPES),
});

type Source = z.infer<typeof SourceSchema>;

const nonNegativeIntegerSchema = z.number().int().min(0);
const tableSizeSchema = z.number().int().min(2).max(10);

export const ExtractedTournamentDataSchema = z.object({
	name: z.string().optional(),
	buyIn: nonNegativeIntegerSchema.optional(),
	entryFee: nonNegativeIntegerSchema.optional(),
	startingStack: nonNegativeIntegerSchema.optional(),
	tableSize: tableSizeSchema.optional(),
	chipPurchases: z
		.array(
			z.object({
				name: z.string(),
				cost: nonNegativeIntegerSchema,
				chips: nonNegativeIntegerSchema,
			})
		)
		.optional(),
	blindLevels: z
		.array(
			z.object({
				isBreak: z.boolean(),
				blind1: nonNegativeIntegerSchema.nullable().optional(),
				blind2: nonNegativeIntegerSchema.nullable().optional(),
				blind3: nonNegativeIntegerSchema.nullable().optional(),
				ante: nonNegativeIntegerSchema.nullable().optional(),
				minutes: nonNegativeIntegerSchema.nullable().optional(),
			})
		)
		.optional(),
});

export type ExtractedTournamentData = z.infer<
	typeof ExtractedTournamentDataSchema
>;

export const TOURNAMENT_OUTPUT_SCHEMA = z.object({
	name: z
		.string()
		.nullable()
		.describe(
			"トーナメント名。ソースに明示されている場合のみ。不明なら null。"
		),
	buyIn: nonNegativeIntegerSchema
		.nullable()
		.describe("バイイン金額（数値のみ）。不明なら null。"),
	entryFee: nonNegativeIntegerSchema
		.nullable()
		.describe("エントリーフィー・レイク（数値のみ）。不明なら null。"),
	startingStack: nonNegativeIntegerSchema
		.nullable()
		.describe("スターティングスタック（チップ数）。不明なら null。"),
	tableSize: tableSizeSchema
		.nullable()
		.describe("1テーブルの最大人数（通常9または10）。不明なら null。"),
	chipPurchases: z
		.array(
			z.object({
				name: z.string(),
				cost: nonNegativeIntegerSchema,
				chips: nonNegativeIntegerSchema,
			})
		)
		.nullable()
		.describe(
			"リバイ・アドオン等のチップ購入オプション。存在しない場合は null（空配列は返さない）。"
		),
	blindLevels: z
		.array(
			z.object({
				isBreak: z.boolean().describe("ブレイクは true、通常レベルは false。"),
				blind1: nonNegativeIntegerSchema
					.nullable()
					.describe("スモールブラインド（SB）。不明なら null。"),
				blind2: nonNegativeIntegerSchema
					.nullable()
					.describe("ビッグブラインド（BB）。不明なら null。"),
				blind3: nonNegativeIntegerSchema
					.nullable()
					.describe("ストラドル。存在しない場合は null。"),
				ante: nonNegativeIntegerSchema
					.nullable()
					.describe("アンティ。存在しない場合は null。"),
				minutes: nonNegativeIntegerSchema
					.nullable()
					.describe("レベルの時間（分）。記載がなければ null。"),
			})
		)
		.nullable()
		.describe(
			"ブラインドレベル構成（順番通りに配列）。存在しない場合は null。"
		),
});

const MAX_SEAT_NUMBER = 9;

export const TABLE_PLAYERS_OUTPUT_SCHEMA = z.object({
	seats: z.array(
		z.object({
			seatNumber: z.number().int().min(1).max(MAX_SEAT_NUMBER),
			name: z.string().min(1),
			isHero: z.boolean().nullable(),
		})
	),
});

export type ExtractedTablePlayers = z.infer<typeof TABLE_PLAYERS_OUTPUT_SCHEMA>;

function missingApiKeyError(): TRPCError {
	return new TRPCError({
		code: "INTERNAL_SERVER_ERROR",
		message: "AI extraction is not configured (missing OPENAI_API_KEY)",
	});
}

function assertNotTruncated(response: {
	status?: string | null;
	incomplete_details?: { reason?: string | null } | null;
}): void {
	if (response.incomplete_details?.reason === "max_output_tokens") {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "AI response was truncated (max_output_tokens reached)",
		});
	}
	if (response.status === "incomplete") {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "AI response was incomplete",
		});
	}
}

function missingStructuredOutputError(): TRPCError {
	return new TRPCError({
		code: "INTERNAL_SERVER_ERROR",
		message: "AI did not return structured data",
	});
}

function failedToParseError(): TRPCError {
	return new TRPCError({
		code: "INTERNAL_SERVER_ERROR",
		message: "Failed to parse AI response",
	});
}

async function parseStructuredResponse<T>(call: Promise<T>): Promise<T> {
	try {
		return await call;
	} catch (error) {
		if (error instanceof z.ZodError || error instanceof SyntaxError) {
			throw failedToParseError();
		}
		throw error;
	}
}

function buildInput(sources: Source[], prompt: string): ResponseInput {
	const content: ResponseInputContent[] = sources.map((source) => ({
		type: "input_image",
		detail: "auto",
		image_url: `data:${source.mediaType};base64,${source.data}`,
	}));
	content.push({ type: "input_text", text: prompt });
	return [{ role: "user", content }];
}

function withoutNulls(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(withoutNulls);
	}
	if (typeof value === "object" && value !== null) {
		return Object.fromEntries(
			Object.entries(value)
				.filter(([, entry]) => entry !== null)
				.map(([key, entry]) => [key, withoutNulls(entry)])
		);
	}
	return value;
}

export const aiExtractRouter = router({
	extractTournamentData: protectedProcedure
		.input(
			z.object({
				sources: z.array(SourceSchema).min(1).max(5),
			})
		)
		.mutation(async ({ ctx, input }) => {
			if (!ctx.openaiApiKey) {
				throw missingApiKeyError();
			}

			const client = new OpenAI({ apiKey: ctx.openaiApiKey });

			const response = await parseStructuredResponse(
				client.responses.parse({
					model: AI_MODELS.tournamentExtraction,
					max_output_tokens: EXTRACTION_MAX_OUTPUT_TOKENS,
					input: buildInput(
						input.sources,
						"上記からポーカートーナメントのデータを抽出してください。ソースに明示された値のみ返し、不明なフィールドは null にしてください。"
					),
					text: {
						format: zodTextFormat(
							TOURNAMENT_OUTPUT_SCHEMA,
							"extract_tournament_data"
						),
					},
				})
			);

			assertNotTruncated(response);

			if (!response.output_parsed) {
				throw missingStructuredOutputError();
			}

			const parsed = ExtractedTournamentDataSchema.safeParse(
				withoutNulls(response.output_parsed)
			);
			if (!parsed.success) {
				throw failedToParseError();
			}

			return parsed.data;
		}),

	extractTablePlayers: protectedProcedure
		.input(
			z.object({
				sourceApp: z.enum(TABLE_PLAYER_SOURCE_APP_IDS),
				sources: z.array(SourceSchema).min(1).max(5),
			})
		)
		.mutation(async ({ ctx, input }) => {
			if (!ctx.openaiApiKey) {
				throw missingApiKeyError();
			}

			const client = new OpenAI({ apiKey: ctx.openaiApiKey });
			const appConfig = TABLE_PLAYER_SOURCE_APPS[input.sourceApp];

			const response = await parseStructuredResponse(
				client.responses.parse({
					model: AI_MODELS.seating,
					max_output_tokens: EXTRACTION_MAX_OUTPUT_TOKENS,
					input: buildInput(input.sources, appConfig.prompt),
					text: {
						format: zodTextFormat(
							TABLE_PLAYERS_OUTPUT_SCHEMA,
							"extract_table_players"
						),
					},
				})
			);

			assertNotTruncated(response);

			const parsedOutput = response.output_parsed;
			if (!parsedOutput) {
				throw missingStructuredOutputError();
			}

			const seenSeatNumbers = new Set<number>();
			const deduped = parsedOutput.seats.filter((seat) => {
				if (seenSeatNumbers.has(seat.seatNumber)) {
					return false;
				}
				seenSeatNumbers.add(seat.seatNumber);
				return true;
			});

			return { seats: deduped };
		}),
});
