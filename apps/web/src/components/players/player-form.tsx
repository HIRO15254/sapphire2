import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PlayerFormValues {
	name: string;
}

interface PlayerFormProps {
	defaultValues?: PlayerFormValues;
	isLoading?: boolean;
	onSubmit: (values: PlayerFormValues) => void;
}

export function PlayerForm({
	onSubmit,
	defaultValues,
	isLoading = false,
}: PlayerFormProps) {
	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const name = formData.get("name") as string;
		onSubmit({ name });
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<div className="flex flex-col gap-2">
				<Label htmlFor="name">
					Player Name <span className="text-destructive">*</span>
				</Label>
				<Input
					defaultValue={defaultValues?.name}
					id="name"
					minLength={1}
					name="name"
					placeholder="Enter player name"
					required
				/>
			</div>
			<Button disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</form>
	);
}
