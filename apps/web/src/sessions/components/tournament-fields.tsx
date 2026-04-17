import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";

export interface TournamentPrimaryFieldsProps {
	entryFee?: number;
	onEntryFeeChange?: (value: number | undefined) => void;
	onPlacementChange?: (value: number | undefined) => void;
	onPrizeMoneyChange?: (value: number | undefined) => void;
	onTotalEntriesChange?: (value: number | undefined) => void;
	onTournamentBuyInChange?: (value: number) => void;
	placement?: number;
	prizeMoney?: number;
	totalEntries?: number;
	tournamentBuyIn?: number;
}

export interface TournamentDetailFieldsProps {
	addonCost?: number;
	bountyPrizes?: number;
	currencies?: Array<{ id: string; name: string }>;
	onAddonCostChange?: (value: number | undefined) => void;
	onBountyPrizesChange?: (value: number | undefined) => void;
	onCurrencyChange?: (id: string | undefined) => void;
	onRebuyCostChange?: (value: number | undefined) => void;
	onRebuyCountChange?: (value: number | undefined) => void;
	rebuyCost?: number;
	rebuyCount?: number;
	selectedCurrencyId?: string;
}

const NONE_VALUE = "__none__";

function parseNumericInput(value: string): number | undefined {
	if (!value) {
		return undefined;
	}
	const parsed = Number.parseFloat(value);
	return Number.isNaN(parsed) ? undefined : parsed;
}

export function TournamentPrimaryFields({
	entryFee,
	onEntryFeeChange,
	onPlacementChange,
	onPrizeMoneyChange,
	onTotalEntriesChange,
	onTournamentBuyInChange,
	placement,
	prizeMoney,
	totalEntries,
	tournamentBuyIn,
}: TournamentPrimaryFieldsProps) {
	return (
		<>
			{/* Tournament Buy-in / Entry Fee */}
			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-2">
					<Label htmlFor="tournamentBuyIn">
						Buy-in <span className="text-destructive">*</span>
					</Label>
					<Input
						id="tournamentBuyIn"
						inputMode="numeric"
						min={0}
						onChange={(e) => {
							const val = parseNumericInput(e.target.value);
							onTournamentBuyInChange?.(val ?? 0);
						}}
						placeholder="0"
						required
						type="number"
						value={tournamentBuyIn ?? ""}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="entryFee">Entry Fee</Label>
					<Input
						id="entryFee"
						inputMode="numeric"
						min={0}
						onChange={(e) =>
							onEntryFeeChange?.(parseNumericInput(e.target.value))
						}
						placeholder="0"
						type="number"
						value={entryFee ?? ""}
					/>
				</div>
			</div>

			{/* Prize Money */}
			<div className="flex flex-col gap-2">
				<Label htmlFor="prizeMoney">Prize Money</Label>
				<Input
					id="prizeMoney"
					inputMode="numeric"
					min={0}
					onChange={(e) =>
						onPrizeMoneyChange?.(parseNumericInput(e.target.value))
					}
					placeholder="0"
					type="number"
					value={prizeMoney ?? ""}
				/>
			</div>

			{/* Placement / Total Entries */}
			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-2">
					<Label htmlFor="placement">Placement</Label>
					<Input
						id="placement"
						inputMode="numeric"
						min={1}
						onChange={(e) =>
							onPlacementChange?.(parseNumericInput(e.target.value))
						}
						placeholder="e.g. 3"
						type="number"
						value={placement ?? ""}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="totalEntries">Total Entries</Label>
					<Input
						id="totalEntries"
						inputMode="numeric"
						min={1}
						onChange={(e) =>
							onTotalEntriesChange?.(parseNumericInput(e.target.value))
						}
						placeholder="e.g. 50"
						type="number"
						value={totalEntries ?? ""}
					/>
				</div>
			</div>
		</>
	);
}

export function TournamentDetailFields({
	addonCost,
	bountyPrizes,
	currencies,
	onAddonCostChange,
	onBountyPrizesChange,
	onCurrencyChange,
	onRebuyCostChange,
	onRebuyCountChange,
	rebuyCost,
	rebuyCount,
	selectedCurrencyId,
}: TournamentDetailFieldsProps) {
	return (
		<>
			{/* Currency Selector */}
			{currencies && currencies.length > 0 && (
				<div className="flex flex-col gap-2">
					<Label>Currency</Label>
					<Select
						onValueChange={(v) =>
							onCurrencyChange?.(v === NONE_VALUE ? undefined : v)
						}
						value={selectedCurrencyId ?? NONE_VALUE}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select a currency" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={NONE_VALUE}>None</SelectItem>
							{currencies.map((c) => (
								<SelectItem key={c.id} value={c.id}>
									{c.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="text-muted-foreground text-xs">
						Auto-generates a transaction with the session&apos;s P&L.
					</p>
				</div>
			)}

			{/* Rebuy Count / Rebuy Cost */}
			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-2">
					<Label htmlFor="rebuyCount">Rebuy Count</Label>
					<Input
						id="rebuyCount"
						inputMode="numeric"
						min={0}
						onChange={(e) =>
							onRebuyCountChange?.(parseNumericInput(e.target.value))
						}
						placeholder="0"
						type="number"
						value={rebuyCount ?? ""}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="rebuyCost">Rebuy Cost</Label>
					<Input
						id="rebuyCost"
						inputMode="numeric"
						min={0}
						onChange={(e) =>
							onRebuyCostChange?.(parseNumericInput(e.target.value))
						}
						placeholder="0"
						type="number"
						value={rebuyCost ?? ""}
					/>
				</div>
			</div>

			{/* Addon Cost / Bounty Prizes */}
			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-2">
					<Label htmlFor="addonCost">Addon Cost</Label>
					<Input
						id="addonCost"
						inputMode="numeric"
						min={0}
						onChange={(e) =>
							onAddonCostChange?.(parseNumericInput(e.target.value))
						}
						placeholder="0"
						type="number"
						value={addonCost ?? ""}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="bountyPrizes">Bounty Prizes</Label>
					<Input
						id="bountyPrizes"
						inputMode="numeric"
						min={0}
						onChange={(e) =>
							onBountyPrizesChange?.(parseNumericInput(e.target.value))
						}
						placeholder="0"
						type="number"
						value={bountyPrizes ?? ""}
					/>
				</div>
			</div>
		</>
	);
}

interface TournamentFieldsProps {
	addonCost?: number;
	bountyPrizes?: number;
	currencies?: Array<{ id: string; name: string }>;
	entryFee?: number;
	onAddonCostChange?: (value: number | undefined) => void;
	onBountyPrizesChange?: (value: number | undefined) => void;
	onCurrencyChange?: (id: string | undefined) => void;
	onEntryFeeChange?: (value: number | undefined) => void;
	onPlacementChange?: (value: number | undefined) => void;
	onPrizeMoneyChange?: (value: number | undefined) => void;
	onRebuyCostChange?: (value: number | undefined) => void;
	onRebuyCountChange?: (value: number | undefined) => void;
	onTotalEntriesChange?: (value: number | undefined) => void;
	onTournamentBuyInChange?: (value: number) => void;
	placement?: number;
	prizeMoney?: number;
	rebuyCost?: number;
	rebuyCount?: number;
	selectedCurrencyId?: string;
	totalEntries?: number;
	tournamentBuyIn?: number;
}

export function TournamentFields({
	addonCost,
	bountyPrizes,
	currencies,
	entryFee,
	onAddonCostChange,
	onBountyPrizesChange,
	onCurrencyChange,
	onEntryFeeChange,
	onPlacementChange,
	onPrizeMoneyChange,
	onRebuyCostChange,
	onRebuyCountChange,
	onTotalEntriesChange,
	onTournamentBuyInChange,
	placement,
	prizeMoney,
	rebuyCost,
	rebuyCount,
	selectedCurrencyId,
	totalEntries,
	tournamentBuyIn,
}: TournamentFieldsProps) {
	return (
		<>
			<TournamentPrimaryFields
				entryFee={entryFee}
				onEntryFeeChange={onEntryFeeChange}
				onPlacementChange={onPlacementChange}
				onPrizeMoneyChange={onPrizeMoneyChange}
				onTotalEntriesChange={onTotalEntriesChange}
				onTournamentBuyInChange={onTournamentBuyInChange}
				placement={placement}
				prizeMoney={prizeMoney}
				totalEntries={totalEntries}
				tournamentBuyIn={tournamentBuyIn}
			/>
			<TournamentDetailFields
				addonCost={addonCost}
				bountyPrizes={bountyPrizes}
				currencies={currencies}
				onAddonCostChange={onAddonCostChange}
				onBountyPrizesChange={onBountyPrizesChange}
				onCurrencyChange={onCurrencyChange}
				onRebuyCostChange={onRebuyCostChange}
				onRebuyCountChange={onRebuyCountChange}
				rebuyCost={rebuyCost}
				rebuyCount={rebuyCount}
				selectedCurrencyId={selectedCurrencyId}
			/>
		</>
	);
}
