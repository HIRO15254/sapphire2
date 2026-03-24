import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TournamentFieldsDefaultValues {
	addonCost?: number;
	bountyPrizes?: number;
	entryFee?: number;
	placement?: number;
	prizeMoney?: number;
	rebuyCost?: number;
	rebuyCount?: number;
	totalEntries?: number;
	tournamentBuyIn?: number;
}

interface TournamentFieldsProps {
	defaultValues?: TournamentFieldsDefaultValues;
}

export function TournamentPrimaryFields({
	defaultValues,
}: TournamentFieldsProps) {
	return (
		<>
			{/* Tournament Buy-in / Entry Fee */}
			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-2">
					<Label htmlFor="tournamentBuyIn">
						Buy-in <span className="text-destructive">*</span>
					</Label>
					<Input
						defaultValue={defaultValues?.tournamentBuyIn}
						id="tournamentBuyIn"
						inputMode="numeric"
						min={0}
						name="tournamentBuyIn"
						placeholder="0"
						required
						type="number"
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="entryFee">Entry Fee</Label>
					<Input
						defaultValue={defaultValues?.entryFee}
						id="entryFee"
						inputMode="numeric"
						min={0}
						name="entryFee"
						placeholder="0"
						type="number"
					/>
				</div>
			</div>

			{/* Prize Money */}
			<div className="flex flex-col gap-2">
				<Label htmlFor="prizeMoney">Prize Money</Label>
				<Input
					defaultValue={defaultValues?.prizeMoney}
					id="prizeMoney"
					inputMode="numeric"
					min={0}
					name="prizeMoney"
					placeholder="0"
					type="number"
				/>
			</div>

			{/* Placement / Total Entries */}
			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-2">
					<Label htmlFor="placement">Placement</Label>
					<Input
						defaultValue={defaultValues?.placement}
						id="placement"
						inputMode="numeric"
						min={1}
						name="placement"
						placeholder="e.g. 3"
						type="number"
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="totalEntries">Total Entries</Label>
					<Input
						defaultValue={defaultValues?.totalEntries}
						id="totalEntries"
						inputMode="numeric"
						min={1}
						name="totalEntries"
						placeholder="e.g. 50"
						type="number"
					/>
				</div>
			</div>
		</>
	);
}

export function TournamentDetailFields({
	defaultValues,
}: TournamentFieldsProps) {
	return (
		<>
			{/* Rebuy Count / Rebuy Cost */}
			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-2">
					<Label htmlFor="rebuyCount">Rebuy Count</Label>
					<Input
						defaultValue={defaultValues?.rebuyCount}
						id="rebuyCount"
						inputMode="numeric"
						min={0}
						name="rebuyCount"
						placeholder="0"
						type="number"
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="rebuyCost">Rebuy Cost</Label>
					<Input
						defaultValue={defaultValues?.rebuyCost}
						id="rebuyCost"
						inputMode="numeric"
						min={0}
						name="rebuyCost"
						placeholder="0"
						type="number"
					/>
				</div>
			</div>

			{/* Addon Cost / Bounty Prizes */}
			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-2">
					<Label htmlFor="addonCost">Addon Cost</Label>
					<Input
						defaultValue={defaultValues?.addonCost}
						id="addonCost"
						inputMode="numeric"
						min={0}
						name="addonCost"
						placeholder="0"
						type="number"
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="bountyPrizes">Bounty Prizes</Label>
					<Input
						defaultValue={defaultValues?.bountyPrizes}
						id="bountyPrizes"
						inputMode="numeric"
						min={0}
						name="bountyPrizes"
						placeholder="0"
						type="number"
					/>
				</div>
			</div>
		</>
	);
}

export function TournamentFields({ defaultValues }: TournamentFieldsProps) {
	return (
		<>
			<TournamentPrimaryFields defaultValues={defaultValues} />
			<TournamentDetailFields defaultValues={defaultValues} />
		</>
	);
}
