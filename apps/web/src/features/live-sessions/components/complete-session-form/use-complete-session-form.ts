import { useForm } from "@tanstack/react-form";
import z from "zod";
import {
	optionalNumericString,
	requiredNumericString,
} from "@/shared/lib/form-fields";

interface CashCompleteValues {
	finalStack: number;
	kind: "cash_game";
}

type TournamentCompleteValues =
	| {
			kind: "tournament";
			beforeDeadline: false;
			bountyPrizes: number;
			placement: number;
			prizeMoney: number;
			totalEntries: number;
	  }
	| {
			kind: "tournament";
			beforeDeadline: true;
			bountyPrizes: number;
			prizeMoney: number;
	  };

export type CompleteSessionValues =
	| CashCompleteValues
	| TournamentCompleteValues;

const cashCompleteSchema = z.object({
	finalStack: requiredNumericString({ integer: true, min: 0 }),
});

const tournamentCompleteSchema = z
	.object({
		beforeDeadline: z.boolean(),
		placement: z.string(),
		totalEntries: z.string(),
		prizeMoney: requiredNumericString({ integer: true, min: 0 }),
		bountyPrizes: optionalNumericString({ integer: true, min: 0 }),
	})
	.superRefine((data, ctx) => {
		if (!data.beforeDeadline) {
			const placementResult = requiredNumericString({
				integer: true,
				min: 1,
			}).safeParse(data.placement);
			if (!placementResult.success) {
				for (const issue of placementResult.error.issues) {
					ctx.addIssue({ ...issue, path: ["placement"] });
				}
			}
			const totalEntriesResult = requiredNumericString({
				integer: true,
				min: 1,
			}).safeParse(data.totalEntries);
			if (!totalEntriesResult.success) {
				for (const issue of totalEntriesResult.error.issues) {
					ctx.addIssue({ ...issue, path: ["totalEntries"] });
				}
			}
		}
	});

interface UseCashCompleteFormOptions {
	defaultFinalStack?: number;
	kind: "cash_game";
	onSubmit: (values: CompleteSessionValues) => void;
}

interface UseTournamentCompleteFormOptions {
	kind: "tournament";
	onSubmit: (values: CompleteSessionValues) => void;
}

type UseCompleteSessionFormOptions =
	| UseCashCompleteFormOptions
	| UseTournamentCompleteFormOptions;

export function useCompleteSessionForm(options: UseCompleteSessionFormOptions) {
	const { kind, onSubmit } = options;

	const defaultFinalStack =
		kind === "cash_game"
			? (options as UseCashCompleteFormOptions).defaultFinalStack
			: undefined;

	const cashForm = useForm({
		defaultValues: {
			finalStack:
				defaultFinalStack === undefined ? "" : String(defaultFinalStack),
		},
		onSubmit: ({ value }) => {
			onSubmit({ kind: "cash_game", finalStack: Number(value.finalStack) });
		},
		validators: { onSubmit: cashCompleteSchema },
	});

	const tournamentForm = useForm({
		defaultValues: {
			beforeDeadline: false,
			placement: "",
			totalEntries: "",
			prizeMoney: "0",
			bountyPrizes: "",
		},
		onSubmit: ({ value }) => {
			if (value.beforeDeadline) {
				onSubmit({
					kind: "tournament",
					beforeDeadline: true,
					prizeMoney: Number(value.prizeMoney),
					bountyPrizes: value.bountyPrizes ? Number(value.bountyPrizes) : 0,
				});
			} else {
				onSubmit({
					kind: "tournament",
					beforeDeadline: false,
					placement: Number(value.placement),
					totalEntries: Number(value.totalEntries),
					prizeMoney: Number(value.prizeMoney),
					bountyPrizes: value.bountyPrizes ? Number(value.bountyPrizes) : 0,
				});
			}
		},
		validators: { onSubmit: tournamentCompleteSchema },
	});

	return { kind, cashForm, tournamentForm };
}
