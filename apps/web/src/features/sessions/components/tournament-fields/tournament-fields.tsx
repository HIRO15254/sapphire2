import type { ReactFormExtendedApi } from "@tanstack/react-form";
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
 * outcome — prizeMoney / placement / total entries / rebuy / addon /
 * bounty. The beforeDeadline checkbox discriminates the result kind
 * (categorical, not a rule).
 */
export function TournamentResultFields({
	form,
	isLiveLinked = false,
}: TournamentFieldsProps) {
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

			<div className="grid grid-cols-2 gap-3">
				<form.Field name="rebuyCount">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Rebuy Count"
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
				<form.Field name="rebuyCost">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Rebuy Cost"
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

			<div className="grid grid-cols-2 gap-3">
				<form.Field name="addonCost">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Addon Cost"
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
			</div>
		</>
	);
}
