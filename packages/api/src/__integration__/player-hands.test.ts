import type { HandAction, HandDetail } from "@sapphire2/db/constants/hand";
import { hand, handAction, handSeat } from "@sapphire2/db/schema/hand";
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
		await api.alice.asset.create({ name: "JPY", kind: "currency" })
	);
	const created = await api.alice.entry.create({
		kind: "cash",
		playedOn: "2026-09-01",
		assetId: jpy.id,
		rule: await nlhGame(api.db),
		playSessions: [
			{
				localDate: "2026-09-01",
				startedAt: at("2026-09-01T10:00:00Z"),
				endedAt: at("2026-09-01T12:00:00Z"),
				endState: "held",
				endStack: 1000,
				payments: [
					{ role: "buy_in", assetId: jpy.id, quantity: 1000, effect: "real" },
				],
			},
			{
				localDate: "2026-09-02",
				startedAt: at("2026-09-02T10:00:00Z"),
				endedAt: at("2026-09-02T12:00:00Z"),
				endState: "cashed_out",
				payments: [
					{ role: "cash_out", assetId: jpy.id, quantity: 900, effect: "real" },
				],
			},
		],
	});
	const [first, second] = created.playSessions;
	if (!(first && second)) {
		throw new Error("missing play sessions");
	}
	const hero = await api.alice.player.getSelf();
	const villain = await api.alice.player.create({ name: "Villain" });
	const other = await api.alice.player.create({ name: "Other" });
	return { hero, villain, other, days: [first.id, second.id] as const };
}

async function insertHands(
	api: ApiFixture,
	playSessionId: string,
	heroId: string,
	specs: HandSpec[]
) {
	for (const [index, spec] of specs.entries()) {
		await api.db.insert(hand).values({
			id: spec.id,
			userId: "alice",
			playSessionId,
			handNo: index + 1,
			playedAt: spec.playedAt === null ? null : new Date(spec.playedAt),
			detail: spec.detail,
			updatedAt: new Date(),
		});
		await api.db.insert(handSeat).values(
			spec.seats.map((playerId, seat) => ({
				handId: spec.id,
				userId: "alice",
				seat,
				playerId,
				isHero: playerId === heroId,
			}))
		);
		if (spec.actions && spec.actions.length > 0) {
			await api.db.insert(handAction).values(
				spec.actions.map(([seat, street, action], seq) => ({
					handId: spec.id,
					userId: "alice",
					seq: seq + 1,
					street,
					seat,
					action,
				}))
			);
		}
	}
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
			id: "limp",
			detail: "full",
			playedAt: "2026-09-01T10:01:00Z",
			seats: seats(),
			actions: [
				[0, 0, "post"],
				[1, 0, "post"],
				[2, 0, "call"],
				[0, 0, "check"],
			],
		},
		{
			id: "four-bet",
			detail: "full",
			playedAt: "2026-09-01T10:02:00Z",
			seats: seats(),
			actions: [
				[0, 0, "post"],
				[1, 0, "post"],
				[2, 0, "raise"],
				[0, 0, "raise"],
				[2, 0, "raise"],
				[0, 0, "call"],
				[2, 1, "bet"],
			],
		},
		{
			id: "three-bet",
			detail: "full",
			playedAt: "2026-09-01T10:03:00Z",
			seats: seats(),
			actions: [
				[0, 0, "post"],
				[1, 0, "raise"],
				[2, 0, "raise"],
				[1, 0, "fold"],
			],
		},
		{
			id: "forced-only",
			detail: "full",
			playedAt: "2026-09-01T10:04:00Z",
			seats: seats(),
			actions: [
				[2, 0, "straddle"],
				[0, 0, "raise"],
				[2, 0, "fold"],
			],
		},
		{
			id: "summary-note",
			detail: "summary",
			playedAt: null,
			seats: seats(),
			actions: [[2, 0, "raise"]],
		},
		{
			id: "without-villain",
			detail: "full",
			playedAt: "2026-09-01T10:05:00Z",
			seats: seats(false),
			actions: [[1, 0, "raise"]],
		},
	];
	const secondDay: HandSpec[] = [
		{
			id: "big-blind-check",
			detail: "full",
			playedAt: "2026-09-02T10:01:00Z",
			seats: seats(),
			actions: [
				[1, 0, "post"],
				[2, 0, "post"],
				[0, 0, "call"],
				[1, 0, "call"],
				[2, 0, "check"],
				[2, 1, "bet"],
			],
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
			handCount: 6,
			fullHandCount: 5,
			vpipOpportunities: 5,
			vpipCount: 3,
			vpip: 60,
			pfrOpportunities: 5,
			pfrCount: 2,
			pfr: 40,
		});
		expect(
			await api.alice.player.handStats({
				id: villain.id,
				dateFrom: "2026-09-02",
			})
		).toEqual({
			handCount: 1,
			fullHandCount: 1,
			vpipOpportunities: 1,
			vpipCount: 0,
			vpip: 0,
			pfrOpportunities: 1,
			pfrCount: 0,
			pfr: 0,
		});
		expect(
			await api.alice.player.handStats({
				id: villain.id,
				dateTo: "2026-08-31",
			})
		).toMatchObject({ handCount: 0, vpip: null, pfr: null });
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
			id: villain.id,
			limit: 2,
			cursor: first.nextCursor,
		});
		expect(second.items.map(({ id }) => id)).toEqual(["three-bet", "four-bet"]);
		const third = await api.alice.player.hands({
			id: villain.id,
			limit: 2,
			cursor: second.nextCursor ?? undefined,
		});
		expect(third.items.map(({ id }) => id)).toEqual(["limp", "summary-note"]);
		expect(third.nextCursor).toBeNull();

		await expect(
			api.alice.player.hands({
				id: villain.id,
				dateFrom: "2026-09-02",
				cursor: first.nextCursor,
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
					id: bobPlayer.id,
					cursor: page.nextCursor ?? undefined,
				}),
		]) {
			await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
		}
	});
});
