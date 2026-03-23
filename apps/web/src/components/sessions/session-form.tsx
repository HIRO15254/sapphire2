import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SessionFormValues {
	buyIn: number;
	cashOut: number;
	sessionDate: string;
	type: "cash_game";
}

interface SessionFormProps {
	defaultValues?: Partial<SessionFormValues>;
	isLoading?: boolean;
	onSubmit: (values: SessionFormValues) => void;
}

function getTodayDateString(): string {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function SessionForm({
	defaultValues,
	isLoading = false,
	onSubmit,
}: SessionFormProps) {
	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);

		const values: SessionFormValues = {
			type: "cash_game",
			sessionDate: formData.get("sessionDate") as string,
			buyIn: Number(formData.get("buyIn")),
			cashOut: Number(formData.get("cashOut")),
		};

		onSubmit(values);
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<div className="flex flex-col gap-2">
				<Label htmlFor="sessionDate">
					Session Date <span className="text-destructive">*</span>
				</Label>
				<Input
					defaultValue={defaultValues?.sessionDate ?? getTodayDateString()}
					id="sessionDate"
					name="sessionDate"
					required
					type="date"
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="buyIn">
					Buy-in <span className="text-destructive">*</span>
				</Label>
				<Input
					defaultValue={defaultValues?.buyIn}
					id="buyIn"
					inputMode="numeric"
					min={0}
					name="buyIn"
					placeholder="0"
					required
					type="number"
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="cashOut">
					Cash-out <span className="text-destructive">*</span>
				</Label>
				<Input
					defaultValue={defaultValues?.cashOut}
					id="cashOut"
					inputMode="numeric"
					min={0}
					name="cashOut"
					placeholder="0"
					required
					type="number"
				/>
			</div>

			<Button disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</form>
	);
}
