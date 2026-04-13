import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface TournamentCompleteFormProps {
	isLoading: boolean;
	onSubmit: (
		values:
			| {
					beforeDeadline: false;
					bountyPrizes: number;
					placement: number;
					prizeMoney: number;
					totalEntries: number;
			  }
			| {
					beforeDeadline: true;
					bountyPrizes: number;
					prizeMoney: number;
			  }
	) => void;
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
		const bountyPrizes = bountyRaw ? Number(bountyRaw) : 0;

		onSubmit({
			beforeDeadline: false,
			placement,
			totalEntries,
			prizeMoney,
			bountyPrizes,
		});
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<Field htmlFor="placement" label="Placement" required>
				<Input
					id="placement"
					inputMode="numeric"
					min={1}
					name="placement"
					placeholder="1"
					required
					type="number"
				/>
			</Field>

			<Field htmlFor="totalEntries" label="Total Entries" required>
				<Input
					id="totalEntries"
					inputMode="numeric"
					min={1}
					name="totalEntries"
					placeholder="100"
					required
					type="number"
				/>
			</Field>

			<Field htmlFor="prizeMoney" label="Prize Money" required>
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
			</Field>

			<Field htmlFor="bountyPrizes" label="Bounty Prizes">
				<Input
					id="bountyPrizes"
					inputMode="numeric"
					min={0}
					name="bountyPrizes"
					placeholder="0"
					type="number"
				/>
			</Field>

			<DialogActionRow>
				<Button disabled={isLoading} type="submit">
					{isLoading ? "Completing..." : "Complete Tournament"}
				</Button>
			</DialogActionRow>
		</form>
	);
}
