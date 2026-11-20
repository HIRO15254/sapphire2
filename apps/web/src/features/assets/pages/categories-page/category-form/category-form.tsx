import type { WalletCategory } from "@/features/assets/hooks/use-wallet-data";
import { firstError } from "@/features/assets/utils/form";
import { IconPicker } from "@/shared/components/icon-picker";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { type CategoryFormSubmit, useCategoryForm } from "./use-category-form";

interface CategoryFormProps {
	category: WalletCategory | null;
	formId: string;
	onSubmit: (values: CategoryFormSubmit) => Promise<void>;
}

export function CategoryForm({
	category,
	formId,
	onSubmit,
}: CategoryFormProps) {
	const {
		form,
		nameError,
		onFormSubmit,
		onIconChange,
		onNameBlur,
		onNameChange,
	} = useCategoryForm({ category, onSubmit });

	return (
		<form
			className="flex items-start gap-2.5 pt-1 pb-2"
			id={formId}
			noValidate
			onSubmit={onFormSubmit}
		>
			<form.Field name="icon">
				{(field) => (
					<div className="flex flex-none flex-col gap-1.5">
						<Label htmlFor="category-icon">Icon</Label>
						<IconPicker
							emptyIcon="category"
							id="category-icon"
							onValueChange={onIconChange(field.handleChange)}
							size="xl"
							value={field.state.value}
							variant="icon"
						/>
					</div>
				)}
			</form.Field>
			<form.Field name="name">
				{(field) => (
					<Field
						className="min-w-0 flex-1"
						error={nameError ?? firstError(field.state.meta.errors)}
						htmlFor="category-name"
						label="Name"
						required
					>
						<Input
							id="category-name"
							onBlur={onNameBlur(field.handleBlur)}
							onChange={onNameChange(field.handleChange)}
							size="xl"
							type="text"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
		</form>
	);
}
