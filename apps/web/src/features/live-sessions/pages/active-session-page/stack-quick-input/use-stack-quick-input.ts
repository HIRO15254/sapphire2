import { useForm } from "@tanstack/react-form";
import z from "zod";
import { stackStaleness } from "@/features/live-sessions/utils/stack-staleness";
import {
	optionalNumericString,
	parseOptionalInt,
	requiredNumericString,
} from "@/shared/lib/form-fields";

interface UseStackQuickInputOptions {
	defaultRemainingPlayers?: number | null;
	defaultTotalEntries?: number | null;
	kind: "cash_game" | "tournament";
	lastStackUpdatedAt: Date | string | number | null;
	onRecordStack: (values: {
		remainingPlayers?: number;
		stackAmount: number;
		totalEntries?: number;
	}) => void;
}

const stackQuickInputSchema = z
	.object({
		stackAmount: requiredNumericString({ integer: true, min: 0 }),
		remainingPlayers: optionalNumericString({ integer: true, min: 0 }),
		totalEntries: optionalNumericString({ integer: true, min: 0 }),
	})
	.refine(
		(value) => {
			const remaining = parseOptionalInt(value.remainingPlayers);
			const total = parseOptionalInt(value.totalEntries);
			if (remaining === undefined || total === undefined) {
				return true;
			}
			return remaining <= total;
		},
		{
			message: "Remaining players must be at most total entries",
			path: ["remainingPlayers"],
		}
	);

function defaultPlayersField(value: number | null | undefined): string {
	return value === null || value === undefined ? "" : String(value);
}

function formatHhMm(value: Date | string | number): string {
	const date = new Date(value);
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

export function useStackQuickInput({
	defaultRemainingPlayers,
	defaultTotalEntries,
	lastStackUpdatedAt,
	onRecordStack,
}: UseStackQuickInputOptions) {
	const form = useForm({
		defaultValues: {
			stackAmount: "",
			remainingPlayers: defaultPlayersField(defaultRemainingPlayers),
			totalEntries: defaultPlayersField(defaultTotalEntries),
		},
		onSubmit: ({ value }) => {
			const remainingPlayers = parseOptionalInt(value.remainingPlayers);
			const totalEntries = parseOptionalInt(value.totalEntries);
			const payload: {
				remainingPlayers?: number;
				stackAmount: number;
				totalEntries?: number;
			} = { stackAmount: Number(value.stackAmount) };
			if (remainingPlayers !== undefined) {
				payload.remainingPlayers = remainingPlayers;
			}
			if (totalEntries !== undefined) {
				payload.totalEntries = totalEntries;
			}
			onRecordStack(payload);
			form.setFieldValue("stackAmount", "");
		},
		validators: {
			onSubmit: stackQuickInputSchema,
		},
	});

	return {
		form,
		lastUpdateText:
			lastStackUpdatedAt === null ? null : formatHhMm(lastStackUpdatedAt),
		showStaleness: lastStackUpdatedAt !== null,
		staleness: stackStaleness(lastStackUpdatedAt, new Date()),
	};
}
