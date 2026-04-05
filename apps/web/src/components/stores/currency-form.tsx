import { Button } from "@/components/ui/button";
import { DialogActionRow } from "@/components/ui/dialog-action-row";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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

export function CurrencyForm({
	onSubmit,
	onCancel,
	defaultValues,
	isLoading = false,
}: CurrencyFormProps) {
	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const name = formData.get("name") as string;
		const unit = (formData.get("unit") as string) || undefined;
		onSubmit({ name, unit });
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<Field htmlFor="name" label="Currency Name" required>
				<Input
					defaultValue={defaultValues?.name}
					id="name"
					name="name"
					placeholder="e.g. Gold, Points"
					required
				/>
			</Field>
			<Field htmlFor="unit" label="Unit">
				<Input
					defaultValue={defaultValues?.unit}
					id="unit"
					name="unit"
					placeholder="e.g. G, pts"
				/>
			</Field>
			<DialogActionRow>
				{onCancel ? (
					<Button onClick={onCancel} type="button" variant="outline">
						Cancel
					</Button>
				) : null}
				<Button disabled={isLoading} type="submit">
					{isLoading ? "Saving..." : "Save"}
				</Button>
			</DialogActionRow>
		</form>
	);
}
