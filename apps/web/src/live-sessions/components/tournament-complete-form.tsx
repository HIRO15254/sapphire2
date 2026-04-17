import { useForm } from "@tanstack/react-form";
import z from "zod";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

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

const tournamentCompleteFormSchema = z.object({
	placement: z.coerce
		.number({ invalid_type_error: "Placement is required" })
		.int("Must be a whole number")
		.min(1, "Must be at least 1"),
	totalEntries: z.coerce
		.number({ invalid_type_error: "Total entries is required" })
		.int("Must be a whole number")
		.min(1, "Must be at least 1"),
	prizeMoney: z.coerce
		.number({ invalid_type_error: "Prize money is required" })
		.min(0, "Must be 0 or greater"),
	bountyPrizes: z.coerce.number().min(0, "Must be 0 or greater").optional(),
});

export function TournamentCompleteForm({
	isLoading,
	onSubmit,
}: TournamentCompleteFormProps) {
	const form = useForm({
		defaultValues: {
			placement: undefined as number | undefined,
			totalEntries: undefined as number | undefined,
			prizeMoney: 0 as number,
			bountyPrizes: undefined as number | undefined,
		},
		onSubmit: ({ value }) => {
			onSubmit({
				beforeDeadline: false,
				placement: value.placement as number,
				totalEntries: value.totalEntries as number,
				prizeMoney: value.prizeMoney,
				bountyPrizes: value.bountyPrizes ?? 0,
			});
		},
		validators: {
			onSubmit: tournamentCompleteFormSchema,
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
							min={1}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) =>
								field.handleChange(
									e.target.value === "" ? undefined : Number(e.target.value)
								)
							}
							placeholder="1"
							required
							type="number"
							value={
								field.state.value === undefined ? "" : String(field.state.value)
							}
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
							min={1}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) =>
								field.handleChange(
									e.target.value === "" ? undefined : Number(e.target.value)
								)
							}
							placeholder="100"
							type="number"
							value={
								field.state.value === undefined ? "" : String(field.state.value)
							}
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
							min={0}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) =>
								field.handleChange(
									e.target.value === "" ? 0 : Number(e.target.value)
								)
							}
							placeholder="0"
							type="number"
							value={String(field.state.value)}
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
							min={0}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) =>
								field.handleChange(
									e.target.value === "" ? undefined : Number(e.target.value)
								)
							}
							placeholder="0"
							type="number"
							value={
								field.state.value === undefined ? "" : String(field.state.value)
							}
						/>
					</Field>
				)}
			</form.Field>

			<form.Subscribe>
				{(state) => (
					<DialogActionRow>
						<Button
							disabled={isLoading || !state.canSubmit || state.isSubmitting}
							type="submit"
						>
							{isLoading || state.isSubmitting
								? "Completing..."
								: "Complete Tournament"}
						</Button>
					</DialogActionRow>
				)}
			</form.Subscribe>
		</form>
	);
}
