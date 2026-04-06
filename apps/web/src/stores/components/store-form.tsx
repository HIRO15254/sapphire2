import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";

interface StoreFormValues {
	memo?: string;
	name: string;
}

interface StoreFormProps {
	defaultValues?: StoreFormValues;
	isLoading?: boolean;
	onSubmit: (values: StoreFormValues) => void;
}

export function StoreForm({
	onSubmit,
	defaultValues,
	isLoading = false,
}: StoreFormProps) {
	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const name = formData.get("name") as string;
		const memo = (formData.get("memo") as string) || undefined;
		onSubmit({ name, memo });
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<Field htmlFor="name" label="Store Name" required>
				<Input
					defaultValue={defaultValues?.name}
					id="name"
					name="name"
					placeholder="Enter store name"
					required
				/>
			</Field>
			<Field htmlFor="memo" label="Memo">
				<Textarea
					defaultValue={defaultValues?.memo}
					id="memo"
					name="memo"
					placeholder="Optional notes about this store"
				/>
			</Field>
			<Button disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</form>
	);
}
