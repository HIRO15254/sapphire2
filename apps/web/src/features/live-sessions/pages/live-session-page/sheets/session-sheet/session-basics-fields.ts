import type { BlindSlotLabels } from "@/shared/hooks/use-game-groups";
import type { BasicsField } from "./session-basics-tab";

interface FieldDef {
	label: string;
	name: string;
	placeholder: string;
	span: string;
}

export const CASH_NUMBER_FIELDS: FieldDef[] = [
	{ label: "Ante", name: "ante", placeholder: "0", span: "col-span-2" },
	{
		label: "Min buy-in",
		name: "minBuyIn",
		placeholder: "20000",
		span: "col-span-3",
	},
	{
		label: "Max buy-in",
		name: "maxBuyIn",
		placeholder: "60000",
		span: "col-span-3",
	},
];

export const TOURNAMENT_NUMBER_FIELDS: FieldDef[] = [
	{
		label: "Buy-in",
		name: "tournamentBuyIn",
		placeholder: "10000",
		span: "col-span-3",
	},
	{
		label: "Entry fee",
		name: "entryFee",
		placeholder: "1000",
		span: "col-span-3",
	},
	{
		label: "Starting stack",
		name: "startingStack",
		placeholder: "30000",
		span: "col-span-2",
	},
	{
		label: "Bounty",
		name: "bountyAmount",
		placeholder: "0",
		span: "col-span-2",
	},
];

export function blindFieldDefs(labels: BlindSlotLabels): FieldDef[] {
	const slots: { label: string | null; name: string }[] = [
		{ label: labels.blind1, name: "blind1" },
		{ label: labels.blind2, name: "blind2" },
		{ label: labels.blind3, name: "blind3" },
	];
	return slots
		.filter((slot) => slot.label !== null)
		.map((slot) => ({
			label: slot.label ?? "",
			name: slot.name,
			placeholder: "—",
			span: "col-span-2",
		}));
}

export function toBasicsFields(
	defs: readonly FieldDef[],
	serverValues: Readonly<Record<string, number | null>>,
	textOf: (name: string, serverValue: string) => string
): BasicsField[] {
	return defs.map((def) => {
		const serverValue = serverValues[def.name];
		return {
			...def,
			value: textOf(
				def.name,
				serverValue === null || serverValue === undefined
					? ""
					: String(serverValue)
			),
		};
	});
}
