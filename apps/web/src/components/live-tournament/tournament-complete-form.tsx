import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TournamentCompleteFormProps {
	isLoading: boolean;
	onSubmit: (values: {
		bountyPrizes?: number;
		placement: number;
		prizeMoney: number;
		totalEntries: number;
	}) => void;
}

export function TournamentCompleteForm({
	isLoading,
	onSubmit,
}: TournamentCompleteFormProps) {
	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const placement = Number(formData.get("placement"));
		const totalEntries = Number(formData.get("totalEntries"));
		const prizeMoney = Number(formData.get("prizeMoney"));
		const bountyRaw = formData.get("bountyPrizes") as string;
		const bountyPrizes = bountyRaw ? Number(bountyRaw) : undefined;

		onSubmit({ placement, totalEntries, prizeMoney, bountyPrizes });
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<div className="flex flex-col gap-2">
				<Label htmlFor="placement">
					Placement <span className="text-destructive">*</span>
				</Label>
				<Input
					id="placement"
					inputMode="numeric"
					min={1}
					name="placement"
					placeholder="1"
					required
					type="number"
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="totalEntries">
					Total Entries <span className="text-destructive">*</span>
				</Label>
				<Input
					id="totalEntries"
					inputMode="numeric"
					min={1}
					name="totalEntries"
					placeholder="100"
					required
					type="number"
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="prizeMoney">
					Prize Money <span className="text-destructive">*</span>
				</Label>
				<Input
					defaultValue={0}
					id="prizeMoney"
					inputMode="numeric"
					min={0}
					name="prizeMoney"
					placeholder="0"
					required
					type="number"
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="bountyPrizes">Bounty Prizes</Label>
				<Input
					id="bountyPrizes"
					inputMode="numeric"
					min={0}
					name="bountyPrizes"
					placeholder="0"
					type="number"
				/>
			</div>

			<Button className="mt-2" disabled={isLoading} type="submit">
				{isLoading ? "Completing..." : "Complete Tournament"}
			</Button>
		</form>
	);
}
