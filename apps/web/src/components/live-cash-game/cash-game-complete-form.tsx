import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CashGameCompleteFormProps {
	defaultFinalStack?: number;
	isLoading: boolean;
	onSubmit: (values: { finalStack: number }) => void;
}

export function CashGameCompleteForm({
	defaultFinalStack,
	isLoading,
	onSubmit,
}: CashGameCompleteFormProps) {
	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const finalStack = Number(formData.get("finalStack"));

		onSubmit({ finalStack });
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<div className="flex flex-col gap-2">
				<Label htmlFor="finalStack">
					Final Stack <span className="text-destructive">*</span>
				</Label>
				<Input
					defaultValue={defaultFinalStack ?? ""}
					id="finalStack"
					inputMode="numeric"
					min={0}
					name="finalStack"
					placeholder="0"
					required
					type="number"
				/>
			</div>

			<Button className="mt-2" disabled={isLoading} type="submit">
				{isLoading ? "Completing..." : "Complete Session"}
			</Button>
		</form>
	);
}
