import type { ReactFormExtendedApi } from "@tanstack/react-form";
import type { ChipPurchaseRow } from "@/features/rooms/components/chip-purchases-editor";
import { OverrideLabel } from "@/features/sessions/components/override-label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SelectWithClear,
} from "@/shared/components/ui/select";

// biome-ignore-start lint/suspicious/noExplicitAny: tanstack-form's ReactFormExtendedApi has 12 generic parameters; threading a fully typed form through child components would require exporting the parent's full form generics.
type AnyForm = ReactFormExtendedApi<
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any
>;
// biome-ignore-end lint/suspicious/noExplicitAny: end

interface TournamentFieldsProps {
	form: AnyForm;
	isLiveLinked?: boolean;
}

interface TournamentRuleFieldsProps extends TournamentFieldsProps {
	currencies?: Array<{ id: string; name: string }>;
	onCurrencyChange?: (id: string | undefined) => void;
	/** Field labels that diverge from the picked master tournament. */
	overriddenLabels?: ReadonlySet<string>;
	selectedCurrencyId?: string;
}

interface TournamentResultFieldsProps extends TournamentFieldsProps {
	/** Purchase counts (the result) keyed by `ChipPurchaseRow.uid`. */
	chipPurchaseCounts: Record<string, number>;
	/** Rule-defined chip purchases from the wizard's Rules step. */
	chipPurchases: ChipPurchaseRow[];
	onChipPurchaseCountChange: (uid: string, count: number) => void;
}

function parseCountInput(value: string): number {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * One row of the chip-purchase result list: the rule's name + cost on the
 * left, a numeric purchase-count input, and the derived line cost
 * (count × cost). Presentational — all state lives in the wizard hook.
 */
function ChipPurchaseCountRow({
	row,
	count,
	disabled,
	onCountChange,
}: {
	count: number;
	disabled: boolean;
	onCountChange: (count: number) => void;
	row: ChipPurchaseRow;
}) {
	const unitCost = Number.parseInt(row.cost, 10);
	const cost = Number.isFinite(unitCost) ? unitCost : 0;
	const lineCost = cost * count;
	return (
		<div className="flex items-end gap-2">
			<Field
				className="flex flex-1 flex-col gap-1"
				htmlFor={`cpc-${row.uid}`}
				label={row.name || "Chip Purchase"}
			>
				<Input
					disabled={disabled}
					id={`cpc-${row.uid}`}
					inputMode="numeric"
					onChange={(e) => onCountChange(parseCountInput(e.target.value))}
					value={count === 0 ? "" : String(count)}
				/>
			</Field>
			<span className="pb-2 text-muted-foreground text-sm">
				× {cost} = {lineCost}
			</span>
		</div>
	);
}

/**
 * Phase B (Rules) tournament fields. Cost-of-entry (buyIn / entryFee) and
 * the linked currency belong here because they describe the master rule —
 * how much the session costs to play. Result fields (prizeMoney /
 * placement / rebuy / addon / bounty) live in TournamentResultFields.
 */
export function TournamentRuleFields({
	currencies,
	form,
	isLiveLinked = false,
	onCurrencyChange,
	overriddenLabels,
	selectedCurrencyId,
}: TournamentRuleFieldsProps) {
	return (
		<>
			<div className="grid grid-cols-2 gap-3">
				<form.Field name="tournamentBuyIn">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label={
								<OverrideLabel label="Buy-in" overridden={overriddenLabels} />
							}
							required
						>
							<Input
								disabled={isLiveLinked}
								id={field.name}
								inputMode="numeric"
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
				<form.Field name="entryFee">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label={
								<OverrideLabel
									label="Entry Fee"
									overridden={overriddenLabels}
								/>
							}
						>
							<Input
								disabled={isLiveLinked}
								id={field.name}
								inputMode="numeric"
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
			</div>
			{currencies && currencies.length > 0 && (
				<Field label="Currency">
					<SelectWithClear
						onValueChange={onCurrencyChange}
						value={selectedCurrencyId}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{currencies.map((c) => (
								<SelectItem key={c.id} value={c.id}>
									{c.name}
								</SelectItem>
							))}
						</SelectContent>
					</SelectWithClear>
				</Field>
			)}
		</>
	);
}

/**
 * Phase C (Result) tournament fields. Everything here is a session-level
 * outcome — prizeMoney / placement / total entries / chip-purchase counts /
 * bounty. The beforeDeadline checkbox discriminates the result kind
 * (categorical, not a rule). Chip purchase counts are recorded per
 * rule-defined chip purchase (defined in the Rules step); cost is derived
 * from the rule, never entered free-form here.
 */
export function TournamentResultFields({
	form,
	isLiveLinked = false,
	chipPurchases,
	chipPurchaseCounts,
	onChipPurchaseCountChange,
}: TournamentResultFieldsProps) {
	return (
		<>
			<div className="flex items-center gap-2">
				<form.Field name="beforeDeadline">
					{(field) => (
						<>
							<Checkbox
								checked={field.state.value === true}
								disabled={isLiveLinked}
								id={field.name}
								onCheckedChange={(checked) =>
									field.handleChange(checked === true)
								}
							/>
							<Label htmlFor={field.name}>
								Finished before registration close
							</Label>
						</>
					)}
				</form.Field>
			</div>

			<form.Subscribe selector={(state) => state.values.beforeDeadline}>
				{(beforeDeadline) =>
					beforeDeadline !== true && (
						<div className="grid grid-cols-2 gap-3">
							<form.Field name="placement">
								{(field) => (
									<Field
										error={field.state.meta.errors[0]?.message}
										htmlFor={field.name}
										label="Placement"
									>
										<Input
											disabled={isLiveLinked}
											id={field.name}
											inputMode="numeric"
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											value={field.state.value}
										/>
									</Field>
								)}
							</form.Field>
							<form.Field name="totalEntries">
								{(field) => (
									<Field
										error={field.state.meta.errors[0]?.message}
										htmlFor={field.name}
										label="Total Entries"
									>
										<Input
											disabled={isLiveLinked}
											id={field.name}
											inputMode="numeric"
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											value={field.state.value}
										/>
									</Field>
								)}
							</form.Field>
						</div>
					)
				}
			</form.Subscribe>

			<form.Field name="prizeMoney">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Prize Money"
					>
						<Input
							disabled={isLiveLinked}
							id={field.name}
							inputMode="numeric"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<form.Field name="bountyPrizes">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Bounty Prizes"
					>
						<Input
							disabled={isLiveLinked}
							id={field.name}
							inputMode="numeric"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			{chipPurchases.length > 0 && (
				<Field className="rounded-md border p-3" label="Chip Purchases">
					<div className="flex flex-col gap-2">
						{chipPurchases.map((row) => (
							<ChipPurchaseCountRow
								count={chipPurchaseCounts[row.uid] ?? 0}
								disabled={isLiveLinked}
								key={row.uid}
								onCountChange={(count) =>
									onChipPurchaseCountChange(row.uid, count)
								}
								row={row}
							/>
						))}
					</div>
				</Field>
			)}
		</>
	);
}
