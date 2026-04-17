import { useForm } from "@tanstack/react-form";
import z from "zod";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface CashGameCompleteFormProps {
	defaultFinalStack?: number;
	isLoading: boolean;
	onSubmit: (values: { finalStack: number }) => void;
}

const cashGameCompleteFormSchema = z.object({
	finalStack: z.coerce
		.number({ invalid_type_error: "Final stack is required" })
		.min(0, "Final stack must be 0 or greater"),
});

export function CashGameCompleteForm({
	defaultFinalStack,
	isLoading,
	onSubmit,
}: CashGameCompleteFormProps) {
	const form = useForm({
		defaultValues: {
			finalStack: defaultFinalStack ?? (undefined as number | undefined),
		},
		onSubmit: ({ value }) => {
			onSubmit({ finalStack: value.finalStack as number });
		},
		validators: {
			onSubmit: cashGameCompleteFormSchema,
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
			<form.Field name="finalStack">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Final Stack"
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
									e.target.value === "" ? undefined : Number(e.target.value)
								)
							}
							placeholder="0"
							type="number"
							value={field.state.value !== undefined ? String(field.state.value) : ""}
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
							{isLoading || state.isSubmitting ? "Completing..." : "Complete Session"}
						</Button>
					</DialogActionRow>
				)}
			</form.Subscribe>
		</form>
	);
}
