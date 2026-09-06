import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import z from "zod";
import {
	optionalNumericString,
	parseOptionalInt,
	requiredNumericString,
} from "@/shared/lib/form-fields";

const tournamentQuickInputSchema = z.object({
	remainingPlayers: optionalNumericString({ integer: true, min: 1 }),
	stackAmount: requiredNumericString({ integer: true, min: 0 }),
	totalEntries: optionalNumericString({ integer: true, min: 1 }),
});

export interface TournamentStackValues {
	remainingPlayers?: number;
	stackAmount: number;
	totalEntries?: number;
}

interface UseTournamentQuickInputOptions {
	currentStack: number | null;
	isSaving: boolean;
	onSubmit: (values: TournamentStackValues) => void;
	remainingPlayers: number | null;
	totalEntries: number | null;
}

function toFieldValue(value: number | null): string {
	return value === null ? "" : String(value);
}

export function useTournamentQuickInput({
	currentStack,
	isSaving,
	onSubmit,
	remainingPlayers,
	totalEntries,
}: UseTournamentQuickInputOptions) {
	const serverValues = {
		remainingPlayers: toFieldValue(remainingPlayers),
		stackAmount: toFieldValue(currentStack),
		totalEntries: toFieldValue(totalEntries),
	};

	const form = useForm({
		defaultValues: serverValues,
		onSubmit: ({ value }) => {
			onSubmit({
				remainingPlayers: parseOptionalInt(value.remainingPlayers),
				stackAmount: Number(value.stackAmount),
				totalEntries: parseOptionalInt(value.totalEntries),
			});
		},
		validators: {
			onSubmit: tournamentQuickInputSchema,
		},
	});

	useEffect(() => {
		if (isSaving) {
			return;
		}
		form.reset({
			remainingPlayers: toFieldValue(remainingPlayers),
			stackAmount: toFieldValue(currentStack),
			totalEntries: toFieldValue(totalEntries),
		});
	}, [currentStack, form, isSaving, remainingPlayers, totalEntries]);

	return { form };
}
