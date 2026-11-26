import type {
	GameGroup,
	GameVariant,
} from "@/features/games/hooks/use-game-masters";
import {
	anteTypeRuns,
	applyAnteType,
	isAnteType,
	type LineupSlot,
	levelAnteTypes,
	type StakeDraft,
	slotGames,
	slotNames,
} from "@/features/games/utils/stakes";

export interface UseAnteTypeBulkOptions {
	groups: GameGroup[] | undefined;
	levels: (StakeDraft[] | null)[];
	onChange: (next: (StakeDraft[] | null)[]) => void;
	slots: LineupSlot[];
	variants: GameVariant[] | undefined;
}

function bulkNote(
	locked: boolean,
	mixed: boolean,
	types: ReturnType<typeof levelAnteTypes>
): string | null {
	if (locked) {
		return "Set by the structure.";
	}
	return mixed ? anteTypeRuns(types) : null;
}

export function useAnteTypeBulk({
	groups,
	levels,
	onChange,
	slots,
	variants,
}: UseAnteTypeBulkOptions) {
	const names = slotNames(slots, groups);

	const cards = slots.map((slot, index) => {
		const name = names[index] ?? "";
		const fixed = groups?.find(
			(group) => group.id === slot.gameGroupId
		)?.fixedAnteType;
		const types = levelAnteTypes(levels, index);
		const distinct = new Set(types);
		const mixed = !fixed && distinct.size > 1;
		const uniform = distinct.size === 1 ? types[0] : null;
		return {
			games: slotGames(slot, variants),
			key: `${slot.gameGroupId}-${index}`,
			locked: Boolean(fixed),
			mixed,
			name,
			note: bulkNote(Boolean(fixed), mixed, types),
			onApply: (next: string) => {
				if (isAnteType(next)) {
					onChange(applyAnteType(levels, index, next));
				}
			},
			value: fixed ?? uniform ?? "",
		};
	});

	return { cards };
}
