import { type ChangeEvent, useId } from "react";
import type {
	GameGroup,
	GameVariant,
} from "@/features/games/hooks/use-game-masters";
import {
	BLIND_FIELDS,
	type BlindField,
	effectiveAnteType,
	isAntePaid,
	isAnteType,
	type StakeDraft,
	type StakeField,
	slotGames,
	slotNames,
	stakeErrors,
	withAnteType,
} from "@/features/games/utils/stakes";

const BLIND_COLUMNS = [
	"",
	"grid-cols-1",
	"grid-cols-2",
	"grid-cols-3",
] as const;

export interface UseStakesFieldsOptions {
	checkRequired: boolean;
	groups: GameGroup[] | undefined;
	onChange: (next: StakeDraft[]) => void;
	value: StakeDraft[];
	variants: GameVariant[] | undefined;
}

export function useStakesFields({
	checkRequired,
	groups,
	onChange,
	value,
	variants,
}: UseStakesFieldsOptions) {
	const baseId = useId();
	const names = slotNames(value, groups);

	const update = (index: number, next: StakeDraft) =>
		onChange(value.map((stake, at) => (at === index ? next : stake)));
	const onAmount =
		(index: number, field: StakeField, stake: StakeDraft) =>
		(event: ChangeEvent<HTMLInputElement>) =>
			update(index, { ...stake, [field]: event.target.value });

	const cards = value.map((stake, index) => {
		const group = groups?.find((item) => item.id === stake.gameGroupId);
		const name = names[index] ?? "";
		const errors = stakeErrors(stake, group, checkRequired);
		const anteType = effectiveAnteType(stake, group);
		const locked = Boolean(group?.fixedAnteType);
		const id = `${baseId}-${index}`;
		const blinds = BLIND_FIELDS.flatMap((field: BlindField) => {
			const label = group?.[`${field}Label`];
			if (!label) {
				return [];
			}
			return [
				{
					error: errors[field],
					field,
					id: `${id}-${field}`,
					label,
					onChange: onAmount(index, field, stake),
					required: group[`${field}Required`],
					value: stake[field],
				},
			];
		});
		return {
			ante: {
				disabled: !isAntePaid(anteType),
				error: errors.ante,
				id: `${id}-ante`,
				label: `Ante amount for ${name}`,
				onChange: onAmount(index, "ante", stake),
				value: isAntePaid(anteType) ? stake.ante : "",
			},
			anteType: {
				label: `Who pays the ante in ${name}`,
				locked,
				note: locked ? "Set by the structure." : null,
				onChange: (next: string) => {
					if (isAnteType(next)) {
						update(index, withAnteType(stake, next));
					}
				},
				value: anteType ?? "",
			},
			blindColumns: BLIND_COLUMNS[blinds.length] ?? "",
			blinds,
			games: slotGames(stake, variants),
			key: `${stake.gameGroupId}-${index}`,
			name,
		};
	});

	return { cards };
}
