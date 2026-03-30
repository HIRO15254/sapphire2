import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BuyInFormProps {
	isLoading: boolean;
	onSubmit: (values: { amount: number }) => void;
}

export function BuyInForm({ isLoading, onSubmit }: BuyInFormProps) {
	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const amount = Number(formData.get("amount"));

		onSubmit({ amount });
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<div className="flex flex-col gap-2">
				<Label htmlFor="amount">
					Amount <span className="text-destructive">*</span>
				</Label>
				<Input
					id="amount"
					inputMode="numeric"
					min={0}
					name="amount"
					placeholder="0"
					required
					type="number"
				/>
			</div>

			<Button className="mt-2" disabled={isLoading} type="submit">
				{isLoading ? "Recording..." : "Record Buy-in"}
			</Button>
		</form>
	);
}
