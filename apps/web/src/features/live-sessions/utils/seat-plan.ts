import { createOptimisticId } from "@/utils/optimistic-update";
import type { ScanRow } from "./seat-scan-review";

export type SeatPlanHeroStep =
	| { kind: "clearHero" }
	| { kind: "moveHero"; seatPosition: number };

export type SeatPlanTableStep =
	| { kind: "leave"; playerId: string }
	| { kind: "moveExisting"; playerId: string; seatPosition: number }
	| {
			kind: "seatExisting";
			name: string;
			playerId: string;
			seatPosition: number;
	  }
	| { kind: "seatNew"; name: string; seatPosition: number };

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

function seatStep(row: ScanRow, active: Set<string>): SeatPlanStep | null {
	const name = row.name.trim();
	const playerId = row.matchedPlayerId;
	if (playerId === null) {
		return name === ""
			? null
			: { kind: "seatNew", name, seatPosition: row.seatPosition };
	}
	if (active.has(playerId)) {
		return { kind: "moveExisting", playerId, seatPosition: row.seatPosition };
	}
	active.add(playerId);
	return {
		kind: "seatExisting",
		name,
		playerId,
		seatPosition: row.seatPosition,
	};
}

function leaveStep(
	playerId: string | null,
	incoming: ReadonlySet<string>,
	active: Set<string>
): SeatPlanStep | null {
	if (playerId === null || incoming.has(playerId)) {
		return null;
	}
	active.delete(playerId);
	return { kind: "leave", playerId };
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
			steps.push({ kind: "moveHero", seatPosition: row.seatPosition });
			continue;
		}
		const isVacate = row.kind === "vacate";
		const seat = isVacate ? null : seatStep(row, active);
		if (!(isVacate || seat)) {
			continue;
		}
		steps.push(
			...[
				seat,
				isVacate ? leaveStep(row.currentPlayerId, incoming, active) : null,
				heroClearStep(row, isHeroMoving),
				row.kind === "conflict"
					? leaveStep(row.currentPlayerId, incoming, active)
					: null,
			].filter((step): step is SeatPlanStep => step !== null)
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

export function projectSeatPlan<TStint>(
	items: readonly SeatPlanItem<TStint>[],
	steps: readonly SeatPlanTableStep[],
	joinedAt: string
): SeatPlanItem<TStint>[] {
	let next = [...items];
	for (const step of steps) {
		if (step.kind === "leave") {
			next = next.map((item) =>
				item.isActive && item.player.id === step.playerId
					? { ...item, isActive: false, seatPosition: null }
					: item
			);
			continue;
		}
		if (step.kind === "moveExisting") {
			next = next.map((item) =>
				item.isActive && item.player.id === step.playerId
					? { ...item, seatPosition: step.seatPosition }
					: item
			);
			continue;
		}
		if (step.kind === "seatExisting") {
			next = [
				...next,
				seatedItem(step.playerId, step.name, step.seatPosition, joinedAt),
			];
			continue;
		}
		if (step.kind === "seatNew") {
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
	}
	return next;
}
