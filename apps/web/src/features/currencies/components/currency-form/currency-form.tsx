import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import type { CurrencyFormValues } from "./use-currency-form";
import { UNIT_MAX_LENGTH, useCurrencyForm } from "./use-currency-form";

interface CurrencyFormProps {
	defaultValues?: CurrencyFormValues;
	isLoading?: boolean;
	onSubmit: (values: CurrencyFormValues) => void;
}

export function CurrencyForm({
	onSubmit,
	defaultValues,
	isLoading = false,
}: CurrencyFormProps) {
	const { form } = useCurrencyForm({ defaultValues, onSubmit });

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
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="unit">
				{(field) => (
					<Field
						description={
							<span className="flex items-center justify-between gap-2">
								<span>Up to {UNIT_MAX_LENGTH} half-width characters.</span>
								<span className="shrink-0 tabular-nums">
									{field.state.value.length}/{UNIT_MAX_LENGTH}
								</span>
							</span>
						}
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Unit"
					>
						<Input
							id={field.name}
							maxLength={UNIT_MAX_LENGTH}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
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
							{isLoading ? "Saving..." : "Save"}
						</Button>
					)}
				</form.Subscribe>
			</DialogActionRow>
		</form>
	);
}
