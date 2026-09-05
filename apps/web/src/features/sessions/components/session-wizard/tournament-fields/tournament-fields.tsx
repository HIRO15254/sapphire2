import type { ReactFormExtendedApi } from "@tanstack/react-form";
import { OverrideLabel } from "@/features/sessions/components/override-label";
import type { ChipPurchaseRow } from "@/shared/components/chip-purchases-editor";
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
import { ChipPurchaseCountRow } from "./chip-purchase-count-row";

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
	overriddenLabels?: ReadonlySet<string>;
	selectedCurrencyId?: string;
}

interface TournamentResultFieldsProps {
	chipPurchaseCounts: Record<string, number>;
	chipPurchases: ChipPurchaseRow[];
	disabledFields: ReadonlySet<string>;
	form: AnyForm;
	onChipPurchaseCountChange: (uid: string, count: number) => void;
	requiredFields?: ReadonlySet<string>;
}

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
									label="Entry fee"
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

export function TournamentResultFields({
	form,
	disabledFields,
	chipPurchases,
	chipPurchaseCounts,
	onChipPurchaseCountChange,
	requiredFields,
}: TournamentResultFieldsProps) {
	return (
		<>
			<div className="flex items-center gap-2">
				<form.Field name="beforeDeadline">
					{(field) => (
						<>
							<Checkbox
								checked={field.state.value === true}
								disabled={disabledFields.has("beforeDeadline")}
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
										required={requiredFields?.has("placement")}
									>
										<Input
											disabled={disabledFields.has("placement")}
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
										label="Total entries"
										required={requiredFields?.has("totalEntries")}
									>
										<Input
											disabled={disabledFields.has("totalEntries")}
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
						label="Prize money"
						required={requiredFields?.has("prizeMoney")}
					>
						<Input
							disabled={disabledFields.has("prizeMoney")}
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
						label="Bounty prizes"
						required={requiredFields?.has("bountyPrizes")}
					>
						<Input
							disabled={disabledFields.has("bountyPrizes")}
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
				<Field className="rounded-md border p-3" label="Chip purchases">
					<div className="flex flex-col gap-2">
						{chipPurchases.map((row) => (
							<ChipPurchaseCountRow
								count={chipPurchaseCounts[row.uid] ?? 0}
								disabled={disabledFields.has("chipPurchases")}
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
