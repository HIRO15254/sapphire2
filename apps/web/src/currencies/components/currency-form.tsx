import { useForm } from "@tanstack/react-form";
import z from "zod";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface CurrencyFormValues {
	name: string;
	unit?: string;
}

interface CurrencyFormProps {
	defaultValues?: CurrencyFormValues;
	isLoading?: boolean;
	onCancel?: () => void;
	onSubmit: (values: CurrencyFormValues) => void;
}

const currencyFormSchema = z.object({
	name: z
		.string()
		.min(1, "Currency name is required")
		.max(100, "Currency name must be 100 characters or less"),
	unit: z.string().max(10, "Unit must be 10 characters or less").optional(),
});

export function CurrencyForm({
	onSubmit,
	onCancel,
	defaultValues,
	isLoading = false,
}: CurrencyFormProps) {
	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			unit: defaultValues?.unit ?? "",
		},
		onSubmit: ({ value }) => {
			onSubmit({
				name: value.name,
				unit: value.unit || undefined,
			});
		},
		validators: {
			onSubmit: currencyFormSchema,
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
			<form.Field name="name">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Currency Name"
						required
					>
						<Input
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="e.g. Gold, Points"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="unit">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Unit"
					>
						<Input
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="e.g. G, pts"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Subscribe>
				{(state) => (
					<DialogActionRow>
						{onCancel ? (
							<Button onClick={onCancel} type="button" variant="outline">
								Cancel
							</Button>
						) : null}
						<Button disabled={isLoading || !state.canSubmit || state.isSubmitting} type="submit">
							{isLoading || state.isSubmitting ? "Saving..." : "Save"}
						</Button>
					</DialogActionRow>
				)}
			</form.Subscribe>
		</form>
	);
}
