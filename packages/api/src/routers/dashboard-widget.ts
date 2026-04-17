import type { Database } from "@sapphire2/db";
import { dashboardWidget } from "@sapphire2/db/schema/dashboard-widget";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";
import {
	type Device,
	deviceSchema,
	getDefaultWidgetConfig,
	parseWidgetConfig,
	stringifyWidgetConfig,
	type WidgetType,
	widgetPositionSchema,
	widgetTypeSchema,
} from "../types/dashboard-widget";

// Permissive input: each widget type has its own config shape and the union
// would silently strip fields that don't match the first-matching schema.
// Validation happens later via parseWidgetConfig(widgetType, ...) against the
// correct type-specific schema, with invalid values falling back to defaults.
const widgetConfigInputSchema = z.record(z.string(), z.unknown());

type WidgetRow = typeof dashboardWidget.$inferSelect;

interface WidgetResponse {
	config: Record<string, unknown>;
	createdAt: Date;
	device: Device;
	h: number;
	id: string;
	type: WidgetType;
	updatedAt: Date;
	userId: string;
	w: number;
	x: number;
	y: number;
}

interface DefaultWidgetDefinition {
	desktop: { x: number; y: number; w: number; h: number };
	mobile: { x: number; y: number; w: number; h: number };
	type: WidgetType;
}

const DEFAULT_WIDGETS: DefaultWidgetDefinition[] = [
	{
		type: "summary_stats",
		desktop: { x: 0, y: 0, w: 6, h: 2 },
		mobile: { x: 0, y: 0, w: 4, h: 2 },
	},
	{
		type: "active_session",
		desktop: { x: 6, y: 0, w: 6, h: 2 },
		mobile: { x: 0, y: 2, w: 4, h: 2 },
	},
	{
		type: "recent_sessions",
		desktop: { x: 0, y: 2, w: 6, h: 3 },
		mobile: { x: 0, y: 4, w: 4, h: 3 },
	},
];

function serializeWidget(row: WidgetRow): WidgetResponse {
	return {
		id: row.id,
		userId: row.userId,
		device: row.device as Device,
		type: row.type as WidgetType,
		config: parseWidgetConfig(row.type as WidgetType, row.config),
		x: row.x,
		y: row.y,
		w: row.w,
		h: row.h,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

async function computeNextAvailableY(
	db: Database,
	userId: string,
	device: Device
): Promise<number> {
	const rows = await db
		.select({ y: dashboardWidget.y, h: dashboardWidget.h })
		.from(dashboardWidget)
		.where(
			and(
				eq(dashboardWidget.userId, userId),
				eq(dashboardWidget.device, device)
			)
		);
	if (rows.length === 0) {
		return 0;
	}
	return Math.max(...rows.map((r) => r.y + r.h));
}

export const dashboardWidgetRouter = router({
	list: protectedProcedure
		.input(z.object({ device: deviceSchema }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const existing = await ctx.db
				.select()
				.from(dashboardWidget)
				.where(
					and(
						eq(dashboardWidget.userId, userId),
						eq(dashboardWidget.device, input.device)
					)
				)
				.orderBy(asc(dashboardWidget.y), asc(dashboardWidget.x));

			if (existing.length > 0) {
				return existing.map(serializeWidget);
			}

			const now = new Date();
			const toInsert = DEFAULT_WIDGETS.map((def) => {
				const position = input.device === "desktop" ? def.desktop : def.mobile;
				return {
					id: crypto.randomUUID(),
					userId,
					device: input.device,
					type: def.type,
					config: stringifyWidgetConfig(getDefaultWidgetConfig(def.type)),
					x: position.x,
					y: position.y,
					w: position.w,
					h: position.h,
					createdAt: now,
					updatedAt: now,
				};
			});
			await ctx.db.insert(dashboardWidget).values(toInsert);

			const seeded = await ctx.db
				.select()
				.from(dashboardWidget)
				.where(
					and(
						eq(dashboardWidget.userId, userId),
						eq(dashboardWidget.device, input.device)
					)
				)
				.orderBy(asc(dashboardWidget.y), asc(dashboardWidget.x));

			return seeded.map(serializeWidget);
		}),

	create: protectedProcedure
		.input(
			z.object({
				device: deviceSchema,
				type: widgetTypeSchema,
				config: widgetConfigInputSchema.optional(),
				position: widgetPositionSchema.optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const position = input.position ?? {
				x: 0,
				y: await computeNextAvailableY(ctx.db, userId, input.device),
				w: input.device === "desktop" ? 6 : 4,
				h: 2,
			};

			const config = stringifyWidgetConfig(
				input.config
					? parseWidgetConfig(input.type, JSON.stringify(input.config))
					: getDefaultWidgetConfig(input.type)
			);

			const id = crypto.randomUUID();
			const now = new Date();
			await ctx.db.insert(dashboardWidget).values({
				id,
				userId,
				device: input.device,
				type: input.type,
				config,
				x: position.x,
				y: position.y,
				w: position.w,
				h: position.h,
				createdAt: now,
				updatedAt: now,
			});

			const [created] = await ctx.db
				.select()
				.from(dashboardWidget)
				.where(eq(dashboardWidget.id, id));
			if (!created) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create widget",
				});
			}
			return serializeWidget(created);
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				config: widgetConfigInputSchema.optional(),
				position: widgetPositionSchema.optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(dashboardWidget)
				.where(eq(dashboardWidget.id, input.id));

			if (!found) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Widget not found",
				});
			}
			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this widget",
				});
			}

			const updateData: Partial<typeof found> = { updatedAt: new Date() };
			if (input.config !== undefined) {
				updateData.config = stringifyWidgetConfig(
					parseWidgetConfig(
						found.type as WidgetType,
						JSON.stringify(input.config)
					)
				);
			}
			if (input.position !== undefined) {
				updateData.x = input.position.x;
				updateData.y = input.position.y;
				updateData.w = input.position.w;
				updateData.h = input.position.h;
			}

			await ctx.db
				.update(dashboardWidget)
				.set(updateData)
				.where(eq(dashboardWidget.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(dashboardWidget)
				.where(eq(dashboardWidget.id, input.id));
			if (!updated) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update widget",
				});
			}
			return serializeWidget(updated);
		}),

	updateLayouts: protectedProcedure
		.input(
			z.object({
				device: deviceSchema,
				items: z
					.array(
						z.object({
							id: z.string(),
							x: z.number().int().min(0),
							y: z.number().int().min(0),
							w: z.number().int().min(1),
							h: z.number().int().min(1),
						})
					)
					.min(1),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const ids = input.items.map((i) => i.id);

			const owned = await ctx.db
				.select()
				.from(dashboardWidget)
				.where(inArray(dashboardWidget.id, ids));

			if (owned.length !== ids.length) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "One or more widgets not found",
				});
			}
			for (const row of owned) {
				if (row.userId !== userId) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You do not own one or more widgets",
					});
				}
				if (row.device !== input.device) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "Widget device mismatch",
					});
				}
			}

			const now = new Date();
			for (const item of input.items) {
				await ctx.db
					.update(dashboardWidget)
					.set({
						x: item.x,
						y: item.y,
						w: item.w,
						h: item.h,
						updatedAt: now,
					})
					.where(eq(dashboardWidget.id, item.id));
			}

			return { success: true, count: input.items.length };
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(dashboardWidget)
				.where(eq(dashboardWidget.id, input.id));

			if (!found) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Widget not found",
				});
			}
			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this widget",
				});
			}

			await ctx.db
				.delete(dashboardWidget)
				.where(eq(dashboardWidget.id, input.id));
			return { success: true };
		}),
});
