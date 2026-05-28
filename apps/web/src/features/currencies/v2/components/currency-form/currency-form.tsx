import {
	type CurrencyFormValues,
	UNIT_MAX_LENGTH,
	useCurrencyForm,
} from "@/features/currencies/components/currency-form/use-currency-form";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface CurrencyFormV2Props {
	defaultValues?: CurrencyFormValues;
	/**
	 * Stable id assigned to the `<form>` element so an external Save button
	 * (rendered by the surrounding ResponsiveDialog header / footer) can
	 * submit it via the HTML `form` attribute.
	 */
	formId: string;
	onSubmit: (values: CurrencyFormValues) => void;
}

export function CurrencyFormV2({
	defaultValues,
	formId,
	onSubmit,
}: CurrencyFormV2Props) {
	const { form } = useCurrencyForm({ defaultValues, onSubmit });

	return (
		<form
			className="flex flex-col gap-4"
			id={formId}
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
						label="Currency name"
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
		</form>
	);
}
