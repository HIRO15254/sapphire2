import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { requiredNumericString } from "@/shared/lib/form-fields";

interface CashGameCompleteFormProps {
	defaultFinalStack?: number;
	isLoading: boolean;
	onSubmit: (values: { finalStack: number }) => void;
}

const cashGameCompleteSchema = z.object({
	finalStack: requiredNumericString({ integer: true, min: 0 }),
});

export function CashGameCompleteForm({
	defaultFinalStack,
	isLoading,
	onSubmit,
}: CashGameCompleteFormProps) {
	const form = useForm({
		defaultValues: {
			finalStack:
				defaultFinalStack === undefined ? "" : String(defaultFinalStack),
		},
		onSubmit: ({ value }) => {
			onSubmit({ finalStack: Number(value.finalStack) });
		},
		validators: {
			onSubmit: cashGameCompleteSchema,
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
							{isLoading ? "Completing..." : "Complete Session"}
						</Button>
					)}
				</form.Subscribe>
			</DialogActionRow>
		</form>
	);
}
