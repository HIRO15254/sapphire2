/// <reference path="../types/turndown.d.ts" />
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// Cloudflare Workers には DOMParser が存在しないため、Turndown の内部 HTML 解析の
// 代わりに純粋 JS DOM 実装の domino を使用する（Turndown の依存として同梱済み）
import domino from "@mixmark-io/domino";
import { TRPCError } from "@trpc/server";
import TurndownService from "turndown";
import { tables } from "turndown-plugin-gfm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";
import {
	TABLE_PLAYER_SOURCE_APP_IDS,
	TABLE_PLAYER_SOURCE_APPS,
} from "./ai-extract-sources";

const IMAGE_URL_RE = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i;

const MEDIA_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

const SourceSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("url"),
		url: z.string().url(),
	}),
	z.object({
		kind: z.literal("image"),
		data: z.string(),
		mediaType: z.enum(MEDIA_TYPES),
	}),
]);

const ExtractedTournamentDataSchema = z.object({
	name: z.string().optional(),
	buyIn: z.number().optional(),
	entryFee: z.number().optional(),
	startingStack: z.number().optional(),
	tableSize: z.number().optional(),
	chipPurchases: z
		.array(
			z.object({
				name: z.string(),
				cost: z.number(),
				chips: z.number(),
			})
		)
		.optional(),
	blindLevels: z
		.array(
			z.object({
				isBreak: z.boolean(),
				blind1: z.number().nullable().optional(),
				blind2: z.number().nullable().optional(),
				blind3: z.number().nullable().optional(),
				ante: z.number().nullable().optional(),
				minutes: z.number().nullable().optional(),
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
			})
		)
		.default([]),
});

export type ExtractedTablePlayers = z.infer<typeof ExtractedTablePlayersSchema>;

const TOOL_INPUT_SCHEMA = {
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
			type: "number",
			description:
				"バイイン金額（数値のみ）。ソースに明示されている場合のみ含める。",
		},
		entryFee: {
			type: "number",
			description:
				"エントリーフィー・レイク（数値のみ）。ソースに明示されている場合のみ含める。",
		},
		startingStack: {
			type: "number",
			description:
				"スターティングスタック（チップ数）。ソースに明示されている場合のみ含める。",
		},
		tableSize: {
			type: "number",
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
					cost: { type: "number" },
					chips: { type: "number" },
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
						type: "number",
						description: "スモールブラインド（SB）。不明な場合は省略。",
					},
					blind2: {
						type: "number",
						description: "ビッグブラインド（BB）。不明な場合は省略。",
					},
					blind3: {
						type: "number",
						description: "ストラドル。存在する場合のみ含める。",
					},
					ante: {
						type: "number",
						description: "アンティ。存在する場合のみ含める。",
					},
					minutes: {
						type: "number",
						description: "レベルの時間（分）。記載がある場合のみ含める。",
					},
				},
				required: ["isBreak"],
			},
		},
	},
};

async function fetchAndConvertToMarkdown(url: string): Promise<string> {
	const res = await fetch(url, {
		headers: {
			"User-Agent": "Mozilla/5.0 (compatible; TournamentExtractor/1.0)",
		},
	});
	const cleanedHtml = await new HTMLRewriter()
		.on("script, style, noscript, nav, header, footer, aside", {
			element(el) {
				el.remove();
			},
		})
		.transform(res)
		.text();

	const trimmed = cleanedHtml.trim();
	if (!trimmed) {
		return "";
	}

	// Cloudflare Workers には DOMParser が存在しない。
	// Turndown の依存パッケージ @mixmark-io/domino（純粋 JS DOM 実装）で
	// パースし DOM ノードを渡すことで Turndown の内部 HTML 解析を迂回する。
	const doc = domino.createDocument(trimmed);
	const td = new TurndownService({
		headingStyle: "atx",
		codeBlockStyle: "fenced",
	});
	td.use(tables);
	return td.turndown(doc.body).trim().slice(0, 30_000);
}

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

			const allBlocks = await Promise.all(
				input.sources.map(
					async (
						source
					): Promise<
						Anthropic.ImageBlockParam | Anthropic.TextBlockParam | null
					> => {
						if (source.kind === "image") {
							return {
								type: "image",
								source: {
									type: "base64",
									media_type: source.mediaType as MediaType,
									data: source.data,
								},
							};
						}
						if (IMAGE_URL_RE.test(source.url)) {
							return {
								type: "image",
								source: { type: "url", url: source.url },
							};
						}
						const markdown = await fetchAndConvertToMarkdown(source.url);
						if (!markdown) {
							return null;
						}
						return {
							type: "text",
							text: `[ソース: ${source.url}]\n\n${markdown}`,
						};
					}
				)
			);
			const contentBlocks: (
				| Anthropic.ImageBlockParam
				| Anthropic.TextBlockParam
			)[] = allBlocks.filter((b) => b !== null);

			contentBlocks.push({
				type: "text",
				text: "上記のコンテンツからポーカートーナメントの構造データを抽出してください。各フィールドはソースに明確に記載されている場合のみ返してください。推測・空文字列・ゼロ埋めは行わず、不明なフィールドは省略してください。",
			});

			const response = await client.messages.create({
				model: "claude-sonnet-4-6",
				max_tokens: 2048,
				tools: [
					{
						name: "extract_tournament_data",
						description:
							"ポーカートーナメントの構造データを抽出する。ソースに明示されているフィールドのみを含めること。不明・未記載のフィールドは省略する（空文字列・0・null は返さない）。",
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
			const appConfig = TABLE_PLAYER_SOURCE_APPS[input.sourceApp];

			const imageBlocks: Anthropic.ImageBlockParam[] = input.sources.map(
				(source) => {
					if (source.kind === "image") {
						return {
							type: "image",
							source: {
								type: "base64",
								media_type: source.mediaType as MediaType,
								data: source.data,
							},
						};
					}
					return {
						type: "image",
						source: { type: "url", url: source.url },
					};
				}
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
				model: "claude-opus-4-7",
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
