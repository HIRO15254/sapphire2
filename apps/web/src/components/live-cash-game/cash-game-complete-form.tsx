import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CashGameCompleteFormProps {
	isLoading: boolean;
	onSubmit: (values: { cashOut: number }) => void;
}

export function CashGameCompleteForm({
	isLoading,
	onSubmit,
}: CashGameCompleteFormProps) {
	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const cashOut = Number(formData.get("cashOut"));

		onSubmit({ cashOut });
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<div className="flex flex-col gap-2">
				<Label htmlFor="cashOut">
					Cash Out Amount <span className="text-destructive">*</span>
				</Label>
				<Input
					id="cashOut"
					inputMode="numeric"
					min={0}
					name="cashOut"
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
