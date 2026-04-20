import Anthropic from "@anthropic-ai/sdk";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

const MEDIA_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

const ExtractedPlayerNamesSchema = z.object({
	players: z
		.array(
			z.object({
				name: z.string(),
			})
		)
		.default([]),
});

export type ExtractedPlayerNames = z.infer<typeof ExtractedPlayerNamesSchema>;

const TOOL_INPUT_SCHEMA = {
	type: "object" as const,
	required: ["players"],
	properties: {
		players: {
			type: "array",
			description:
				"List of player names extracted from the waiting list. Each entry should contain a single player name.",
			items: {
				type: "object",
				properties: {
					name: {
						type: "string",
						description:
							"The player name extracted from the list. Should be the name only, without numbers or other metadata.",
					},
				},
				required: ["name"],
			},
		},
	},
};

export const aiExtractPlayersRouter = router({
	extractPlayerNames: protectedProcedure
		.input(
			z.object({
				image: z.object({
					data: z.string(),
					mediaType: z.enum(MEDIA_TYPES),
				}),
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

			const response = await client.messages.create({
				model: "claude-sonnet-4-6",
				max_tokens: 2048,
				tools: [
					{
						name: "extract_player_names",
						description:
							"Extract player names from a waiting list screenshot. Return all player names found in the image.",
						input_schema: TOOL_INPUT_SCHEMA,
					},
				],
				tool_choice: { type: "tool", name: "extract_player_names" },
				messages: [
					{
						role: "user",
						content: [
							{
								type: "image",
								source: {
									type: "base64",
									media_type: input.image.mediaType as MediaType,
									data: input.image.data,
								},
							},
							{
								type: "text",
								text: "This is a screenshot of a poker waiting list. Please extract all player names from this list. Return only the player names, ignoring any additional metadata like chips, position, or numbering. If no clear waiting list is visible, return an empty array.",
							},
						],
					},
				],
			});

			const toolUse = response.content.find((c) => c.type === "tool_use");
			if (!toolUse || toolUse.type !== "tool_use") {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "AI did not return structured data",
				});
			}

			const parsed = ExtractedPlayerNamesSchema.safeParse(toolUse.input);
			if (!parsed.success) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to parse AI response",
				});
			}

			return parsed.data;
		}),
});
