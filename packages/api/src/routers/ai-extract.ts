import { MAX_SEAT_POSITION } from "@sapphire2/db/constants/hand";
import {
	MAX_RULE_TABLE_SIZE,
	MIN_RULE_TABLE_SIZE,
} from "@sapphire2/db/constants/rule";
import { TRPCError } from "@trpc/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type {
	EasyInputMessage,
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
	data: z.string().min(1).base64(),
	kind: z.literal("image"),
	mediaType: z.enum(MEDIA_TYPES),
});

type Source = z.infer<typeof SourceSchema>;

const nonNegativeIntegerSchema = z.number().int().min(0);
const tableSizeSchema = z
	.number()
	.int()
	.min(MIN_RULE_TABLE_SIZE)
	.max(MAX_RULE_TABLE_SIZE);

export const ExtractedTournamentDataSchema = z.object({
	blindLevels: z
		.array(
			z.object({
				ante: nonNegativeIntegerSchema.nullable().optional(),
				blind1: nonNegativeIntegerSchema.nullable().optional(),
				blind2: nonNegativeIntegerSchema.nullable().optional(),
				blind3: nonNegativeIntegerSchema.nullable().optional(),
				isBreak: z.boolean(),
				minutes: nonNegativeIntegerSchema.nullable().optional(),
			})
		)
		.optional(),
	buyIn: nonNegativeIntegerSchema.optional(),
	chipPurchases: z
		.array(
			z.object({
				chips: nonNegativeIntegerSchema,
				cost: nonNegativeIntegerSchema,
				name: z.string(),
			})
		)
		.optional(),
	entryFee: nonNegativeIntegerSchema.optional(),
	name: z.string().optional(),
	startingStack: nonNegativeIntegerSchema.optional(),
	tableSize: tableSizeSchema.optional(),
});

export const TOURNAMENT_OUTPUT_SCHEMA = z.object({
	blindLevels: z
		.array(
			z.object({
				ante: nonNegativeIntegerSchema
					.nullable()
					.describe("アンティ。存在しない場合は null。"),
				blind1: nonNegativeIntegerSchema
					.nullable()
					.describe("スモールブラインド（SB）。不明なら null。"),
				blind2: nonNegativeIntegerSchema
					.nullable()
					.describe("ビッグブラインド（BB）。不明なら null。"),
				blind3: nonNegativeIntegerSchema
					.nullable()
					.describe("ストラドル。存在しない場合は null。"),
				isBreak: z.boolean().describe("ブレイクは true、通常レベルは false。"),
				minutes: nonNegativeIntegerSchema
					.nullable()
					.describe("レベルの時間（分）。記載がなければ null。"),
			})
		)
		.nullable()
		.describe(
			"ブラインドレベル構成（順番通りに配列）。存在しない場合は null。"
		),
	buyIn: nonNegativeIntegerSchema
		.nullable()
		.describe("バイイン金額（数値のみ）。不明なら null。"),
	chipPurchases: z
		.array(
			z.object({
				chips: nonNegativeIntegerSchema,
				cost: nonNegativeIntegerSchema,
				name: z.string(),
			})
		)
		.nullable()
		.describe(
			"リバイ・アドオン等のチップ購入オプション。存在しない場合は null（空配列は返さない）。"
		),
	entryFee: nonNegativeIntegerSchema
		.nullable()
		.describe("エントリーフィー・レイク（数値のみ）。不明なら null。"),
	name: z
		.string()
		.nullable()
		.describe(
			"トーナメント名。ソースに明示されている場合のみ。不明なら null。"
		),
	startingStack: nonNegativeIntegerSchema
		.nullable()
		.describe("スターティングスタック（チップ数）。不明なら null。"),
	tableSize: tableSizeSchema
		.nullable()
		.describe("1テーブルの最大人数（通常9または10）。不明なら null。"),
});

const MAX_SEAT_NUMBER = MAX_SEAT_POSITION + 1;

export const TABLE_PLAYERS_OUTPUT_SCHEMA = z.object({
	seats: z.array(
		z.object({
			isHero: z.boolean().nullable(),
			name: z.string().min(1),
			seatNumber: z.number().int().min(1).max(MAX_SEAT_NUMBER),
		})
	),
});

function missingApiKeyError(): TRPCError {
	return new TRPCError({
		code: "INTERNAL_SERVER_ERROR",
		message: "AI extraction is not configured (missing OPENAI_API_KEY)",
	});
}

function createExtractionClient(apiKey: string): OpenAI {
	return new OpenAI({ apiKey, maxRetries: 1, timeout: 180_000 });
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

function buildInput(sources: Source[], prompt: string): [EasyInputMessage] {
	const content: ResponseInputContent[] = sources.map((source) => ({
		detail: "auto",
		image_url: `data:${source.mediaType};base64,${source.data}`,
		type: "input_image",
	}));
	content.push({ text: prompt, type: "input_text" });
	return [{ content, role: "user" }];
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

			const client = createExtractionClient(ctx.openaiApiKey);
			const appConfig = TABLE_PLAYER_SOURCE_APPS[input.sourceApp];

			const response = await parseStructuredResponse(
				client.responses.parse({
					input: buildInput(input.sources, appConfig.prompt),
					max_output_tokens: EXTRACTION_MAX_OUTPUT_TOKENS,
					model: AI_MODELS.seating,
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

			const client = createExtractionClient(ctx.openaiApiKey);

			const response = await parseStructuredResponse(
				client.responses.parse({
					input: buildInput(
						input.sources,
						"上記からポーカートーナメントのデータを抽出してください。ソースに明示された値のみ返し、不明なフィールドは null にしてください。"
					),
					max_output_tokens: EXTRACTION_MAX_OUTPUT_TOKENS,
					model: AI_MODELS.tournamentExtraction,
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
});
