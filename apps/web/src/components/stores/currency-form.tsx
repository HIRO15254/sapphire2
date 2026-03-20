import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CurrencyFormValues {
	name: string;
	unit?: string;
}

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
	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const name = formData.get("name") as string;
		const unit = (formData.get("unit") as string) || undefined;
		onSubmit({ name, unit });
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<div className="flex flex-col gap-2">
				<Label htmlFor="name">Currency Name</Label>
				<Input
					defaultValue={defaultValues?.name}
					id="name"
					name="name"
					placeholder="e.g. Gold, Points"
					required
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="unit">Unit (optional)</Label>
				<Input
					defaultValue={defaultValues?.unit}
					id="unit"
					name="unit"
					placeholder="e.g. G, pts"
				/>
			</div>
			<Button disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</form>
	);
}
