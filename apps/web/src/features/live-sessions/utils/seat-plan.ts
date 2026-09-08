import { createOptimisticId } from "@/utils/optimistic-update";
import type { ScanRow } from "./seat-scan-review";

export type SeatPlanHeroStep =
	| { kind: "clearHero" }
	| { displaces: string | null; kind: "moveHero"; seatPosition: number };

export type SeatPlanTableStep =
	| { kind: "leave"; playerId: string }
	| {
			displaces: string | null;
			kind: "moveExisting";
			playerId: string;
			seatPosition: number;
	  }
	| {
			displaces: string | null;
			kind: "seatExisting";
			name: string;
			playerId: string;
			seatPosition: number;
	  }
	| {
			displaces: string | null;
			kind: "seatNew";
			name: string;
			seatPosition: number;
	  };

export type SeatPlanStep = SeatPlanHeroStep | SeatPlanTableStep;

export function splitSeatPlan(steps: readonly SeatPlanStep[]): {
	heroSteps: SeatPlanHeroStep[];
	tableSteps: SeatPlanTableStep[];
} {
	const heroSteps: SeatPlanHeroStep[] = [];
	const tableSteps: SeatPlanTableStep[] = [];
	for (const step of steps) {
		if (step.kind === "clearHero" || step.kind === "moveHero") {
			heroSteps.push(step);
		} else {
			tableSteps.push(step);
		}
	}
	return { heroSteps, tableSteps };
}

export interface SeatPlanItem<TStint> {
	id: string;
	isActive: boolean;
	joinedAt: string;
	leftAt: string | null;
	player: {
		id: string;
		isTemporary: boolean;
		memo: string | null;
		name: string;
	};
	seatPosition: number | null;
	stints: TStint[];
}

function seatStep(
	row: ScanRow,
	active: Set<string>,
	displaces: string | null
): SeatPlanStep | null {
	const name = row.name.trim();
	const playerId = row.matchedPlayerId;
	if (playerId === null) {
		return name === ""
			? null
			: { displaces, kind: "seatNew", name, seatPosition: row.seatPosition };
	}
	if (active.has(playerId)) {
		return {
			displaces,
			kind: "moveExisting",
			playerId,
			seatPosition: row.seatPosition,
		};
	}
	active.add(playerId);
	return {
		displaces,
		kind: "seatExisting",
		name,
		playerId,
		seatPosition: row.seatPosition,
	};
}

function displacedPlayerId(
	playerId: string | null,
	incoming: ReadonlySet<string>,
	active: Set<string>
): string | null {
	if (playerId === null || incoming.has(playerId)) {
		return null;
	}
	active.delete(playerId);
	return playerId;
}

function leaveStep(
	playerId: string | null,
	incoming: ReadonlySet<string>,
	active: Set<string>
): SeatPlanStep | null {
	const displaced = displacedPlayerId(playerId, incoming, active);
	return displaced === null ? null : { kind: "leave", playerId: displaced };
}

export function planSeatClear(
	activePlayerIds: readonly string[],
	isHeroSeated: boolean
): SeatPlanStep[] {
	const steps: SeatPlanStep[] = activePlayerIds.map((playerId) => ({
		kind: "leave",
		playerId,
	}));
	return isHeroSeated ? [...steps, { kind: "clearHero" }] : steps;
}

function heroClearStep(
	row: ScanRow,
	isHeroMoving: boolean
): SeatPlanStep | null {
	return row.displacesHero && !isHeroMoving ? { kind: "clearHero" } : null;
}

export function planScanCommit(
	rows: readonly ScanRow[],
	activePlayerIds: ReadonlySet<string>
): SeatPlanStep[] {
	const active = new Set(activePlayerIds);
	const incoming = new Set(
		rows
			.map((row) => row.matchedPlayerId)
			.filter((id): id is string => id !== null)
	);
	const isHeroMoving = rows.some((row) => row.kind === "hero");
	const steps: SeatPlanStep[] = [];

	for (const row of rows) {
		if (row.kind === "hero") {
			steps.push({
				displaces: displacedPlayerId(row.currentPlayerId, incoming, active),
				kind: "moveHero",
				seatPosition: row.seatPosition,
			});
			continue;
		}
		if (row.kind === "vacate") {
			const leave = leaveStep(row.currentPlayerId, incoming, active);
			steps.push(
				...[leave, heroClearStep(row, isHeroMoving)].filter(
					(step): step is SeatPlanStep => step !== null
				)
			);
			continue;
		}
		const seat = seatStep(
			row,
			active,
			row.kind === "conflict"
				? displacedPlayerId(row.currentPlayerId, incoming, active)
				: null
		);
		if (seat === null) {
			continue;
		}
		steps.push(
			...[seat, heroClearStep(row, isHeroMoving)].filter(
				(step): step is SeatPlanStep => step !== null
			)
		);
	}

	return steps;
}

function seatedItem<TStint>(
	playerId: string,
	name: string,
	seatPosition: number,
	joinedAt: string
): SeatPlanItem<TStint> {
	return {
		id: createOptimisticId("optimistic"),
		isActive: true,
		joinedAt,
		leftAt: null,
		player: { id: playerId, isTemporary: false, memo: null, name },
		seatPosition,
		stints: [],
	};
}

function withPlayerLeft<TStint>(
	items: readonly SeatPlanItem<TStint>[],
	playerId: string
): SeatPlanItem<TStint>[] {
	return items.map((item) =>
		item.isActive && item.player.id === playerId
			? { ...item, isActive: false, seatPosition: null }
			: item
	);
}

export function projectSeatPlan<TStint>(
	items: readonly SeatPlanItem<TStint>[],
	steps: readonly SeatPlanTableStep[],
	joinedAt: string
): SeatPlanItem<TStint>[] {
	let next = [...items];
	for (const step of steps) {
		if (step.kind === "leave") {
			next = withPlayerLeft(next, step.playerId);
			continue;
		}
		if (step.kind === "moveExisting") {
			next = next.map((item) =>
				item.isActive && item.player.id === step.playerId
					? { ...item, seatPosition: step.seatPosition }
					: item
			);
		} else if (step.kind === "seatExisting") {
			next = [
				...next,
				seatedItem(step.playerId, step.name, step.seatPosition, joinedAt),
			];
		} else {
			next = [
				...next,
				seatedItem(
					createOptimisticId("new"),
					step.name,
					step.seatPosition,
					joinedAt
				),
			];
		}
		if (step.displaces !== null) {
			next = withPlayerLeft(next, step.displaces);
		}
	}
	return next;
}
