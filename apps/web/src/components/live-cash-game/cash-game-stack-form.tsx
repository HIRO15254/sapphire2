import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AllIn {
	actualResult: number;
	evResult: number;
	id: number;
}

interface CashGameStackFormProps {
	isLoading: boolean;
	onSubmit: (values: {
		addon: { amount: number } | null;
		allIns: Array<{ actualResult: number; evResult: number }>;
		stackAmount: number;
	}) => void;
}

let nextId = 0;

function createAllIn(): AllIn {
	nextId += 1;
	return { id: nextId, actualResult: 0, evResult: 0 };
}

export function CashGameStackForm({
	isLoading,
	onSubmit,
}: CashGameStackFormProps) {
	const [allIns, setAllIns] = useState<AllIn[]>([]);
	const [addonEnabled, setAddonEnabled] = useState(false);

	const addAllIn = () => {
		setAllIns((prev) => [...prev, createAllIn()]);
	};

	const removeAllIn = (id: number) => {
		setAllIns((prev) => prev.filter((item) => item.id !== id));
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);

		const stackAmount = Number(formData.get("stackAmount"));

		const parsedAllIns = allIns.map((allIn) => ({
			actualResult: Number(formData.get(`allIn_actualResult_${allIn.id}`)),
			evResult: Number(formData.get(`allIn_evResult_${allIn.id}`)),
		}));

		const addon = addonEnabled
			? { amount: Number(formData.get("addonAmount")) }
			: null;

		onSubmit({
			stackAmount,
			allIns: parsedAllIns,
			addon,
		});
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<div className="flex flex-col gap-2">
				<Label htmlFor="stackAmount">
					Stack Amount <span className="text-destructive">*</span>
				</Label>
				<Input
					id="stackAmount"
					inputMode="numeric"
					min={0}
					name="stackAmount"
					placeholder="0"
					required
					type="number"
				/>
			</div>

			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<Label>All-ins</Label>
					<Button onClick={addAllIn} size="sm" type="button" variant="outline">
						Add All-in
					</Button>
				</div>

				{allIns.length > 0 && (
					<div className="flex flex-col gap-3">
						{allIns.map((allIn, index) => (
							<div
								className="flex flex-col gap-2 rounded-lg border border-input p-3"
								key={allIn.id}
							>
								<div className="flex items-center justify-between">
									<span className="font-medium text-sm">
										All-in {index + 1}
									</span>
									<Button
										onClick={() => removeAllIn(allIn.id)}
										size="sm"
										type="button"
										variant="destructive"
									>
										Remove
									</Button>
								</div>
								<div className="grid grid-cols-2 gap-3">
									<div className="flex flex-col gap-2">
										<Label htmlFor={`allIn_actualResult_${allIn.id}`}>
											Actual Result
										</Label>
										<Input
											defaultValue={0}
											id={`allIn_actualResult_${allIn.id}`}
											inputMode="numeric"
											name={`allIn_actualResult_${allIn.id}`}
											placeholder="0"
											required
											type="number"
										/>
									</div>
									<div className="flex flex-col gap-2">
										<Label htmlFor={`allIn_evResult_${allIn.id}`}>
											EV Result
										</Label>
										<Input
											defaultValue={0}
											id={`allIn_evResult_${allIn.id}`}
											inputMode="numeric"
											name={`allIn_evResult_${allIn.id}`}
											placeholder="0"
											required
											type="number"
										/>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			<div className="flex flex-col gap-3">
				<div className="flex items-center gap-3">
					<input
						checked={addonEnabled}
						className="h-4 w-4 rounded border-input accent-primary"
						id="addonToggle"
						onChange={(e) => setAddonEnabled(e.target.checked)}
						type="checkbox"
					/>
					<Label htmlFor="addonToggle">Addon</Label>
				</div>

				{addonEnabled && (
					<div className="flex flex-col gap-2">
						<Label htmlFor="addonAmount">
							Addon Amount <span className="text-destructive">*</span>
						</Label>
						<Input
							id="addonAmount"
							inputMode="numeric"
							min={0}
							name="addonAmount"
							placeholder="0"
							required
							type="number"
						/>
					</div>
				)}
			</div>

			<Button className="mt-2" disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save Stack"}
			</Button>
		</form>
	);
}
