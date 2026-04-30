import type { ReactFormExtendedApi } from "@tanstack/react-form";
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
}

interface TournamentDetailFieldsProps extends TournamentFieldsProps {
	currencies?: Array<{ id: string; name: string }>;
	isLiveLinked?: boolean;
	onCurrencyChange?: (id: string | undefined) => void;
	selectedCurrencyId?: string;
}

export function TournamentPrimaryFields({ form }: TournamentFieldsProps) {
	return (
		<>
			<div className="grid grid-cols-2 gap-3">
				<form.Field name="tournamentBuyIn">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Buy-in"
							required
						>
							<Input
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
							label="Entry Fee"
						>
							<Input
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

			<form.Field name="prizeMoney">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Prize Money"
					>
						<Input
							id={field.name}
							inputMode="numeric"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<div className="flex items-center gap-2">
				<form.Field name="beforeDeadline">
					{(field) => (
						<>
							<Checkbox
								checked={field.state.value === true}
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
		</>
	);
}

export function TournamentDetailFields({
	currencies,
	form,
	isLiveLinked = false,
	onCurrencyChange,
	selectedCurrencyId,
}: TournamentDetailFieldsProps) {
	return (
		<>
			{currencies && currencies.length > 0 && (
				<Field
					description="Auto-generates a transaction with the session's P&L."
					label="Currency"
				>
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

			{!isLiveLinked && (
				<>
					<div className="grid grid-cols-2 gap-3">
						<form.Field name="rebuyCount">
							{(field) => (
								<Field
									error={field.state.meta.errors[0]?.message}
									htmlFor={field.name}
									label="Rebuy Count"
								>
									<Input
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
			)}
		</>
	);
}
