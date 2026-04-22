import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
	optionalNumericString,
	requiredNumericString,
} from "@/shared/lib/form-fields";

type TournamentCompleteSubmitValues =
	| {
			beforeDeadline: false;
			bountyPrizes: number;
			placement: number;
			prizeMoney: number;
			totalEntries: number;
	  }
	| {
			beforeDeadline: true;
			bountyPrizes: number;
			prizeMoney: number;
	  };

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

interface UseTournamentCompleteFormOptions {
	onSubmit: (values: TournamentCompleteSubmitValues) => void;
}

export function useTournamentCompleteForm({
	onSubmit,
}: UseTournamentCompleteFormOptions) {
	const form = useForm({
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
					beforeDeadline: true,
					prizeMoney: Number(value.prizeMoney),
					bountyPrizes: value.bountyPrizes ? Number(value.bountyPrizes) : 0,
				});
			} else {
				onSubmit({
					beforeDeadline: false,
					placement: Number(value.placement),
					totalEntries: Number(value.totalEntries),
					prizeMoney: Number(value.prizeMoney),
					bountyPrizes: value.bountyPrizes ? Number(value.bountyPrizes) : 0,
				});
			}
		},
		validators: {
			onSubmit: tournamentCompleteSchema,
		},
	});

	return { form };
}
