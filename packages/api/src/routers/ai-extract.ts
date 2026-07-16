import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { TRPCError } from "@trpc/server";
import z from "zod";
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
type MediaType = (typeof MEDIA_TYPES)[number];

const SourceSchema = z.object({
	kind: z.literal("image"),
	data: z.string().min(1),
	mediaType: z.enum(MEDIA_TYPES),
});

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

const MAX_SEAT_NUMBER = 9;

const ExtractedTablePlayersSchema = z.object({
	seats: z
		.array(
			z.object({
				seatNumber: z.number().int().min(1).max(MAX_SEAT_NUMBER),
				name: z.string().min(1),
				isHero: z.boolean().nullable(),
			})
		)
		.default([]),
});

export type ExtractedTablePlayers = z.infer<typeof ExtractedTablePlayersSchema>;

export const TOOL_INPUT_SCHEMA = {
	type: "object" as const,
	// 全フィールド省略可能 — ソースに明確に記載されているものだけ含める
	required: [] as string[],
	properties: {
		name: {
			type: "string",
			description:
				"トーナメント名。ソースに明示されている場合のみ含める。不明な場合は省略（空文字列不可）。",
		},
		buyIn: {
			type: "integer",
			minimum: 0,
			description:
				"バイイン金額（数値のみ）。ソースに明示されている場合のみ含める。",
		},
		entryFee: {
			type: "integer",
			minimum: 0,
			description:
				"エントリーフィー・レイク（数値のみ）。ソースに明示されている場合のみ含める。",
		},
		startingStack: {
			type: "integer",
			minimum: 0,
			description:
				"スターティングスタック（チップ数）。ソースに明示されている場合のみ含める。",
		},
		tableSize: {
			type: "integer",
			minimum: 2,
			maximum: 10,
			description:
				"1テーブルの最大人数（通常9または10）。ソースに明示されている場合のみ含める。",
		},
		chipPurchases: {
			type: "array",
			description:
				"リバイ・アドオン等のチップ購入オプション。存在する場合のみ含める。空配列は返さない。",
			items: {
				type: "object",
				properties: {
					name: { type: "string" },
					cost: { type: "integer", minimum: 0 },
					chips: { type: "integer", minimum: 0 },
				},
				required: ["name", "cost", "chips"],
			},
		},
		blindLevels: {
			type: "array",
			description:
				"ブラインドレベル構成（順番通りに配列）。存在する場合のみ含める。",
			items: {
				type: "object",
				properties: {
					isBreak: {
						type: "boolean",
						description: "ブレイクはtrue、通常レベルはfalse",
					},
					blind1: {
						type: "integer",
						minimum: 0,
						description: "スモールブラインド（SB）。不明な場合は省略。",
					},
					blind2: {
						type: "integer",
						minimum: 0,
						description: "ビッグブラインド（BB）。不明な場合は省略。",
					},
					blind3: {
						type: "integer",
						minimum: 0,
						description: "ストラドル。存在する場合のみ含める。",
					},
					ante: {
						type: "integer",
						minimum: 0,
						description: "アンティ。存在する場合のみ含める。",
					},
					minutes: {
						type: "integer",
						minimum: 0,
						description: "レベルの時間（分）。記載がある場合のみ含める。",
					},
				},
				required: ["isBreak"],
			},
		},
	},
};

export const aiExtractRouter = router({
	extractTournamentData: protectedProcedure
		.input(
			z.object({
				sources: z.array(SourceSchema).min(1).max(5),
			})
		)
		.mutation(async ({ ctx, input }) => {
			if (!ctx.anthropicApiKey) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message:
						"AI extraction is not configured (missing ANTHROPIC_API_KEY)",
				});
			}

			const client = new Anthropic({ apiKey: ctx.anthropicApiKey });

			const contentBlocks: (
				| Anthropic.ImageBlockParam
				| Anthropic.TextBlockParam
			)[] = input.sources.map((source) => ({
				type: "image",
				source: {
					type: "base64",
					media_type: source.mediaType as MediaType,
					data: source.data,
				},
			}));

			contentBlocks.push({
				type: "text",
				text: "上記からポーカートーナメントのデータを抽出してください。ソースに明示された値のみ返し、不明なフィールドは省略してください。",
			});

			const response = await client.messages.create({
				model: "claude-opus-4-8",
				max_tokens: 2048,
				tools: [
					{
						name: "extract_tournament_data",
						description:
							"ポーカートーナメントの構造データを抽出する。明示されているフィールドのみ含める。不明・未記載は省略（空文字列・null 不可）。",
						input_schema: TOOL_INPUT_SCHEMA,
					},
				],
				tool_choice: { type: "tool", name: "extract_tournament_data" },
				messages: [{ role: "user", content: contentBlocks }],
			});

			const toolUse = response.content.find((c) => c.type === "tool_use");
			if (!toolUse || toolUse.type !== "tool_use") {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "AI did not return structured data",
				});
			}

			const parsed = ExtractedTournamentDataSchema.safeParse(toolUse.input);
			if (!parsed.success) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to parse AI response",
				});
			}

			return parsed.data;
		}),

	extractTablePlayers: protectedProcedure
		.input(
			z.object({
				sourceApp: z.enum(TABLE_PLAYER_SOURCE_APP_IDS),
				sources: z.array(SourceSchema).length(1),
			})
		)
		.mutation(async ({ ctx, input }) => {
			if (!ctx.anthropicApiKey) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message:
						"AI extraction is not configured (missing ANTHROPIC_API_KEY)",
				});
			}

			const client = new Anthropic({ apiKey: ctx.anthropicApiKey });
			const appConfig = TABLE_PLAYER_SOURCE_APPS[input.sourceApp];

			const imageBlocks: Anthropic.ImageBlockParam[] = input.sources.map(
				(source) => ({
					type: "image",
					source: {
						type: "base64",
						media_type: source.mediaType as MediaType,
						data: source.data,
					},
				})
			);

			const contentBlocks: (
				| Anthropic.ImageBlockParam
				| Anthropic.TextBlockParam
			)[] = [
				...imageBlocks,
				{
					type: "text",
					text: appConfig.prompt,
				},
			];

			const response = await client.messages.parse({
				model: "claude-opus-4-8",
				max_tokens: 1024,
				output_config: {
					format: zodOutputFormat(ExtractedTablePlayersSchema),
				},
				messages: [{ role: "user", content: contentBlocks }],
			});

			const parsedOutput = response.parsed_output;
			if (!parsedOutput) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "AI did not return structured data",
				});
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
