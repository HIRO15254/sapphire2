/// <reference path="../types/turndown.d.ts" />
import Anthropic from "@anthropic-ai/sdk";
import { TRPCError } from "@trpc/server";
import TurndownService from "turndown";
import { tables } from "turndown-plugin-gfm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

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

const TOOL_INPUT_SCHEMA = {
	type: "object" as const,
	properties: {
		name: { type: "string", description: "トーナメント名" },
		buyIn: { type: "number", description: "バイイン金額" },
		entryFee: { type: "number", description: "エントリーフィー（レイク）" },
		startingStack: {
			type: "number",
			description: "スターティングスタック（チップ数）",
		},
		tableSize: {
			type: "number",
			description: "1テーブルの最大人数（通常9または10）",
		},
		chipPurchases: {
			type: "array",
			description: "リバイ・アドオン等のチップ購入オプション",
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
			description: "ブラインドレベル構成（順番通りに配列）",
			items: {
				type: "object",
				properties: {
					isBreak: { type: "boolean", description: "ブレイクの場合true" },
					blind1: { type: "number", description: "スモールブラインド" },
					blind2: { type: "number", description: "ビッグブラインド" },
					blind3: { type: "number", description: "ストラドル（任意）" },
					ante: { type: "number", description: "アンティ" },
					minutes: { type: "number", description: "レベルの時間（分）" },
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

	const td = new TurndownService({
		headingStyle: "atx",
		codeBlockStyle: "fenced",
	});
	td.use(tables);
	return td.turndown(cleanedHtml).trim().slice(0, 30_000);
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

			const contentBlocks = await Promise.all(
				input.sources.map(
					async (
						source
					): Promise<Anthropic.ImageBlockParam | Anthropic.TextBlockParam> => {
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
						return {
							type: "text",
							text: `[ソース: ${source.url}]\n\n${markdown}`,
						};
					}
				)
			);

			contentBlocks.push({
				type: "text",
				text: "上記のコンテンツからポーカートーナメントの構造データを抽出してください。確信を持って判断できない項目は省略してください。",
			});

			const response = await client.messages.create({
				model: "claude-haiku-4-5-20251001",
				max_tokens: 2048,
				tools: [
					{
						name: "extract_tournament_data",
						description:
							"ポーカートーナメントの構造データ（ブラインドレベル、バイイン、スターティングスタック等）を抽出する",
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
});
