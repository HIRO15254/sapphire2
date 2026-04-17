import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	optionalNumericString,
	requiredNumericString,
} from "@/shared/lib/form-fields";

interface TournamentCompleteFormProps {
	isLoading: boolean;
	onSubmit: (
		values:
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
	) => void;
}

const tournamentCompleteSchema = z.object({
	placement: requiredNumericString({ integer: true, min: 1 }),
	totalEntries: requiredNumericString({ integer: true, min: 1 }),
	prizeMoney: requiredNumericString({ integer: true, min: 0 }),
	bountyPrizes: optionalNumericString({ integer: true, min: 0 }),
});

export function TournamentCompleteForm({
	isLoading,
	onSubmit,
}: TournamentCompleteFormProps) {
	const form = useForm({
		defaultValues: {
			placement: "",
			totalEntries: "",
			prizeMoney: "0",
			bountyPrizes: "",
		},
		onSubmit: ({ value }) => {
			onSubmit({
				beforeDeadline: false,
				placement: Number(value.placement),
				totalEntries: Number(value.totalEntries),
				prizeMoney: Number(value.prizeMoney),
				bountyPrizes: value.bountyPrizes ? Number(value.bountyPrizes) : 0,
			});
		},
		validators: {
			onSubmit: tournamentCompleteSchema,
		},
	});

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="placement">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Placement"
						required
					>
						<Input
							id={field.name}
							inputMode="numeric"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="1"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<form.Field name="totalEntries">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Total Entries"
						required
					>
						<Input
							id={field.name}
							inputMode="numeric"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="100"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<form.Field name="prizeMoney">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Prize Money"
						required
					>
						<Input
							id={field.name}
							inputMode="numeric"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="0"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<form.Field name="bountyPrizes">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Bounty Prizes"
					>
						<Input
							id={field.name}
							inputMode="numeric"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="0"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<DialogActionRow>
				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
				>
					{([canSubmit, isSubmitting]) => (
						<Button
							disabled={isLoading || !canSubmit || isSubmitting}
							type="submit"
						>
							{isLoading ? "Completing..." : "Complete Tournament"}
						</Button>
					)}
				</form.Subscribe>
			</DialogActionRow>
		</form>
	);
}
