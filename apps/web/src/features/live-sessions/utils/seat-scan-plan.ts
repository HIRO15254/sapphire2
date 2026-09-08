import { createOptimisticId } from "@/utils/optimistic-update";
import type { ScanRow } from "./seat-scan-review";

export type ScanPlanStep =
	| { kind: "clearHero" }
	| { kind: "leave"; playerId: string }
	| { kind: "moveExisting"; playerId: string; seatPosition: number }
	| { kind: "moveHero"; seatPosition: number }
	| {
			kind: "seatExisting";
			name: string;
			playerId: string;
			seatPosition: number;
	  }
	| { kind: "seatNew"; name: string; seatPosition: number };

export interface ScanPlanItem<TStint> {
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

function seatStep(row: ScanRow, active: Set<string>): ScanPlanStep | null {
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
): ScanPlanStep | null {
	if (playerId === null || incoming.has(playerId)) {
		return null;
	}
	active.delete(playerId);
	return { kind: "leave", playerId };
}

export function planScanCommit(
	rows: readonly ScanRow[],
	activePlayerIds: ReadonlySet<string>
): ScanPlanStep[] {
	const active = new Set(activePlayerIds);
	const incoming = new Set(
		rows
			.map((row) => row.matchedPlayerId)
			.filter((id): id is string => id !== null)
	);
	const isHeroMoving = rows.some((row) => row.kind === "hero");
	const steps: ScanPlanStep[] = [];

	for (const row of rows) {
		if (row.kind === "hero") {
			steps.push({ kind: "moveHero", seatPosition: row.seatPosition });
			continue;
		}
		if (row.kind === "vacate") {
			const leave = leaveStep(row.currentPlayerId, incoming, active);
			if (leave) {
				steps.push(leave);
			}
			continue;
		}
		const seat = seatStep(row, active);
		if (seat === null) {
			continue;
		}
		steps.push(seat);
		if (row.displacesHero && !isHeroMoving) {
			steps.push({ kind: "clearHero" });
		}
		if (row.kind === "conflict") {
			const leave = leaveStep(row.currentPlayerId, incoming, active);
			if (leave) {
				steps.push(leave);
			}
		}
	}

	return steps;
}

function seatedItem<TStint>(
	playerId: string,
	name: string,
	seatPosition: number,
	joinedAt: string
): ScanPlanItem<TStint> {
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

export function projectScanPlan<TStint>(
	items: readonly ScanPlanItem<TStint>[],
	steps: readonly ScanPlanStep[],
	joinedAt: string
): ScanPlanItem<TStint>[] {
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
