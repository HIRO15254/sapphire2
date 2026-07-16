import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { RichTextEditor } from "@/shared/components/ui/rich-text-editor";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { type ItemFormValues, useItemForm } from "./use-item-form";

interface ItemFormV2Props {
	defaultValues?: ItemFormValues;
	/**
	 * Stable id assigned to the `<form>` element so an external Save button
	 * (rendered by the surrounding FormSheet toolbar) can submit it via the
	 * HTML `form` attribute.
	 */
	formId: string;
	onSubmit: (values: ItemFormValues) => void;
}

export function ItemFormV2({
	defaultValues,
	formId,
	onSubmit,
}: ItemFormV2Props) {
	const { form, currencies } = useItemForm({ defaultValues, onSubmit });

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
						label="Item name"
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
			<form.Field name="currencyId">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Currency"
						required
					>
						{/* Required select — the raw shadcn Select, not SelectWithClear,
						    because an item always has a currency. */}
						<Select
							onValueChange={(value) => field.handleChange(value)}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{currencies.map((currency) => (
									<SelectItem key={currency.id} value={currency.id}>
										{currency.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>
			<form.Field name="unitValue">
				{(field) => (
					<Field
						description="Currency-equivalent value of one item."
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Unit value"
						required
					>
						<Input
							id={field.name}
							inputMode="numeric"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
			<form.Field name="description">
				{(field) => (
					<Field label="Description">
						<RichTextEditor
							initialContent={field.state.value ?? undefined}
							onChange={(html) => field.handleChange(html || null)}
						/>
					</Field>
				)}
			</form.Field>
		</form>
	);
}
