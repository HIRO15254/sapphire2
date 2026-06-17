import { useForm } from "@tanstack/react-form";
import z from "zod";
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
	  }
	| {
			bagStack: number;
			result: "promoted";
	  };

function applyFieldValidation(
	ctx: z.RefinementCtx,
	path: string,
	schema: z.ZodType,
	value: unknown
): void {
	const result = schema.safeParse(value);
	if (!result.success) {
		for (const issue of result.error.issues) {
			ctx.addIssue({ ...issue, path: [path] });
		}
	}
}

const tournamentCompleteSchema = z
	.object({
		beforeDeadline: z.boolean(),
		promote: z.boolean(),
		placement: z.string(),
		totalEntries: z.string(),
		prizeMoney: z.string(),
		bountyPrizes: z.string(),
		bagStack: z.string(),
	})
	.superRefine((data, ctx) => {
		if (data.promote) {
			applyFieldValidation(
				ctx,
				"bagStack",
				requiredNumericString({ integer: true, min: 0 }),
				data.bagStack
			);
			return;
		}
		applyFieldValidation(
			ctx,
			"prizeMoney",
			requiredNumericString({ integer: true, min: 0 }),
			data.prizeMoney
		);
		applyFieldValidation(
			ctx,
			"bountyPrizes",
			optionalNumericString({ integer: true, min: 0 }),
			data.bountyPrizes
		);
		if (!data.beforeDeadline) {
			applyFieldValidation(
				ctx,
				"placement",
				requiredNumericString({ integer: true, min: 1 }),
				data.placement
			);
			applyFieldValidation(
				ctx,
				"totalEntries",
				requiredNumericString({ integer: true, min: 1 }),
				data.totalEntries
			);
		}
	});

interface UseTournamentCompleteFormOptions {
	/** Whether the linked rule allows promoting to a next day. */
	canPromote?: boolean;
	/** Current stack used to prefill the bag when promoting. */
	defaultBagStack?: number | null;
	onSubmit: (values: TournamentCompleteSubmitValues) => void;
}

export function useTournamentCompleteForm({
	canPromote = false,
	defaultBagStack,
	onSubmit,
}: UseTournamentCompleteFormOptions) {
	const form = useForm({
		defaultValues: {
			beforeDeadline: false,
			promote: false,
			placement: "",
			totalEntries: "",
			prizeMoney: "0",
			bountyPrizes: "",
			bagStack: defaultBagStack == null ? "" : String(defaultBagStack),
		},
		onSubmit: ({ value }) => {
			if (value.promote) {
				onSubmit({ result: "promoted", bagStack: Number(value.bagStack) });
				return;
			}
			const bountyPrizes = value.bountyPrizes ? Number(value.bountyPrizes) : 0;
			if (value.beforeDeadline) {
				onSubmit({
					beforeDeadline: true,
					prizeMoney: Number(value.prizeMoney),
					bountyPrizes,
				});
			} else {
				onSubmit({
					beforeDeadline: false,
					placement: Number(value.placement),
					totalEntries: Number(value.totalEntries),
					prizeMoney: Number(value.prizeMoney),
					bountyPrizes,
				});
			}
		},
		validators: {
			onSubmit: tournamentCompleteSchema,
		},
	});

	return { canPromote, form };
}
