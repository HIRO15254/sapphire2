import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
			<div className="flex flex-col gap-2">
				<Label htmlFor="name">
					Store Name <span className="text-destructive">*</span>
				</Label>
				<Input
					defaultValue={defaultValues?.name}
					id="name"
					name="name"
					placeholder="Enter store name"
					required
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="memo">Memo</Label>
				<textarea
					className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					defaultValue={defaultValues?.memo}
					id="memo"
					name="memo"
					placeholder="Optional notes about this store"
				/>
			</div>
			<Button disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</form>
	);
}
