import type { HandAction, HandDetail } from "@sapphire2/db/constants/hand";
import { playSession } from "@sapphire2/db/schema/entry";
import { hand, handAction, handSeat } from "@sapphire2/db/schema/hand";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
	type ApiFixture,
	nlhGame,
	requireCreatedRow,
	test,
} from "./test-fixture";

const at = (iso: string) => Date.parse(iso) / 1000;

interface HandSpec {
	actions?: [seat: number, street: number, action: HandAction][];
	detail: HandDetail;
	id: string;
	playedAt: string | null;
	seats: string[];
}

async function seedTable(api: ApiFixture) {
	const jpy = requireCreatedRow(
		await api.alice.asset.create({ kind: "currency", name: "JPY" })
	);
	const created = await api.alice.entry.create({
		assetId: jpy.id,
		kind: "cash",
		playedOn: "2026-09-01",
		playSessions: [
			{
				endedAt: at("2026-09-01T12:00:00Z"),
				endStack: 1000,
				endState: "held",
				localDate: "2026-09-01",
				payments: [
					{ assetId: jpy.id, effect: "real", quantity: 1000, role: "buy_in" },
				],
				startedAt: at("2026-09-01T10:00:00Z"),
			},
			{
				endedAt: at("2026-09-02T12:00:00Z"),
				endState: "cashed_out",
				localDate: "2026-09-02",
				payments: [
					{ assetId: jpy.id, effect: "real", quantity: 900, role: "cash_out" },
				],
				startedAt: at("2026-09-02T10:00:00Z"),
			},
		],
		rule: await nlhGame(api.db),
	});
	const [first, second] = created.playSessions;
	if (!(first && second)) {
		throw new Error("missing play sessions");
	}
	const hero = await api.alice.player.getSelf();
	const villain = await api.alice.player.create({ name: "Villain" });
	const other = await api.alice.player.create({ name: "Other" });
	return { days: [first.id, second.id] as const, hero, other, villain };
}

async function insertHands(
	api: ApiFixture,
	playSessionId: string,
	heroId: string,
	specs: HandSpec[]
) {
	for (const [index, spec] of specs.entries()) {
		await api.db.insert(hand).values({
			detail: spec.detail,
			handNo: index + 1,
			id: spec.id,
			playedAt: spec.playedAt === null ? null : new Date(spec.playedAt),
			playSessionId,
			seq: index + 1,
			updatedAt: new Date(),
			userId: "alice",
		});
		await api.db.insert(handSeat).values(
			spec.seats.map((playerId, seat) => ({
				handId: spec.id,
				isHero: playerId === heroId,
				playerId,
				seat,
				userId: "alice",
			}))
		);
		if (spec.actions && spec.actions.length > 0) {
			await api.db.insert(handAction).values(
				spec.actions.map(([seat, street, action], seq) => ({
					action,
					handId: spec.id,
					seat,
					seq: seq + 1,
					street,
					userId: "alice",
				}))
			);
		}
	}
	await api.db
		.update(playSession)
		.set({ nextHandSeq: specs.length })
		.where(eq(playSession.id, playSessionId));
}

async function seedHands(api: ApiFixture) {
	const table = await seedTable(api);
	const seats = (villainSeat = true) => [
		table.hero.id,
		table.other.id,
		...(villainSeat ? [table.villain.id] : []),
	];
	const firstDay: HandSpec[] = [
		{
			actions: [
				[0, 0, "post"],
				[1, 0, "post"],
				[2, 0, "call"],
				[0, 0, "check"],
			],
			detail: "full",
			id: "limp",
			playedAt: "2026-09-01T10:01:00Z",
			seats: seats(),
		},
		{
			actions: [
				[0, 0, "post"],
				[1, 0, "post"],
				[2, 0, "raise"],
				[0, 0, "raise"],
				[2, 0, "raise"],
				[0, 0, "call"],
				[2, 1, "bet"],
			],
			detail: "full",
			id: "four-bet",
			playedAt: "2026-09-01T10:02:00Z",
			seats: seats(),
		},
		{
			actions: [
				[0, 0, "post"],
				[1, 0, "raise"],
				[2, 0, "raise"],
				[1, 0, "fold"],
			],
			detail: "full",
			id: "three-bet",
			playedAt: "2026-09-01T10:03:00Z",
			seats: seats(),
		},
		{
			actions: [
				[2, 0, "straddle"],
				[0, 0, "raise"],
				[2, 0, "fold"],
			],
			detail: "full",
			id: "forced-only",
			playedAt: "2026-09-01T10:04:00Z",
			seats: seats(),
		},
		{
			actions: [[2, 0, "raise"]],
			detail: "summary",
			id: "summary-note",
			playedAt: null,
			seats: seats(),
		},
		{
			actions: [[1, 0, "raise"]],
			detail: "full",
			id: "without-villain",
			playedAt: "2026-09-01T10:05:00Z",
			seats: seats(false),
		},
	];
	const secondDay: HandSpec[] = [
		{
			actions: [
				[1, 0, "post"],
				[2, 0, "post"],
				[0, 0, "call"],
				[1, 0, "call"],
				[2, 0, "check"],
				[2, 1, "bet"],
			],
			detail: "full",
			id: "big-blind-check",
			playedAt: "2026-09-02T10:01:00Z",
			seats: seats(),
		},
	];
	await insertHands(api, table.days[0], table.hero.id, firstDay);
	await insertHands(api, table.days[1], table.hero.id, secondDay);
	return table;
}

describe("opponent hands on D1", () => {
	test("counts VPIP and PFR once per full hand from street-0 voluntary actions only", async ({
		api,
	}) => {
		const { villain } = await seedHands(api);

		expect(await api.alice.player.handStats({ id: villain.id })).toEqual({
			fullHandCount: 5,
			handCount: 6,
			pfr: 40,
			pfrCount: 2,
			pfrOpportunities: 5,
			vpip: 60,
			vpipCount: 3,
			vpipOpportunities: 5,
		});
		expect(
			await api.alice.player.handStats({
				dateFrom: "2026-09-02",
				id: villain.id,
			})
		).toEqual({
			fullHandCount: 1,
			handCount: 1,
			pfr: 0,
			pfrCount: 0,
			pfrOpportunities: 1,
			vpip: 0,
			vpipCount: 0,
			vpipOpportunities: 1,
		});
		expect(
			await api.alice.player.handStats({
				dateTo: "2026-08-31",
				id: villain.id,
			})
		).toMatchObject({ handCount: 0, pfr: null, vpip: null });
	});

	test("pages only the opponent's hands newest first and continues after the cursor hand is deleted", async ({
		api,
	}) => {
		const { villain } = await seedHands(api);

		const first = await api.alice.player.hands({ id: villain.id, limit: 2 });
		expect(first.items.map(({ id }) => id)).toEqual([
			"big-blind-check",
			"forced-only",
		]);
		expect(first.items[0]?.seats.map(({ seat }) => seat)).toEqual([0, 1, 2]);
		expect(first.items[0]?.actions).toHaveLength(6);
		if (!first.nextCursor) {
			throw new Error("expected another page");
		}

		await api.alice.hand.delete({ id: "forced-only" });
		const second = await api.alice.player.hands({
			cursor: first.nextCursor,
			id: villain.id,
			limit: 2,
		});
		expect(second.items.map(({ id }) => id)).toEqual(["three-bet", "four-bet"]);
		const third = await api.alice.player.hands({
			cursor: second.nextCursor ?? undefined,
			id: villain.id,
			limit: 2,
		});
		expect(third.items.map(({ id }) => id)).toEqual(["limp", "summary-note"]);
		expect(third.nextCursor).toBeNull();

		await expect(
			api.alice.player.hands({
				cursor: first.nextCursor,
				dateFrom: "2026-09-02",
				id: villain.id,
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	test("rejects Hero as an opponent and another user's player or cursor", async ({
		api,
	}) => {
		const { hero, villain } = await seedHands(api);
		const page = await api.alice.player.hands({ id: villain.id, limit: 1 });
		const bobPlayer = await api.bob.player.create({ name: "Bob's villain" });

		for (const call of [
			() => api.alice.player.hands({ id: hero.id }),
			() => api.alice.player.handStats({ id: hero.id }),
		]) {
			await expect(call()).rejects.toMatchObject({ code: "BAD_REQUEST" });
		}
		for (const call of [
			() => api.bob.player.hands({ id: villain.id }),
			() => api.bob.player.handStats({ id: villain.id }),
			() =>
				api.bob.player.hands({
					cursor: page.nextCursor ?? undefined,
					id: bobPlayer.id,
				}),
		]) {
			await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
		}
	});
});
