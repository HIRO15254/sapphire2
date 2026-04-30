import type { ReactFormExtendedApi } from "@tanstack/react-form";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
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

interface CashGameFieldsProps {
	currencies?: Array<{ id: string; name: string }>;
	form: AnyForm;
	isLiveLinked?: boolean;
	onCurrencyChange?: (id: string | undefined) => void;
	selectedCurrencyId?: string;
}

const ANTE_TYPES = [
	{ value: "none", label: "No Ante" },
	{ value: "bb", label: "BB Ante" },
	{ value: "all", label: "All Ante" },
] as const;

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function CashGameFields({
	currencies,
	form,
	isLiveLinked = false,
	onCurrencyChange,
	selectedCurrencyId,
}: CashGameFieldsProps) {
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
					<form.Field name="variant">
						{(field) => (
							<Field htmlFor={field.name} label="Variant">
								<Select
									onValueChange={(v) => field.handleChange(v)}
									value={field.state.value}
								>
									<SelectTrigger className="w-full" id={field.name}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="nlh">NL Hold&apos;em</SelectItem>
									</SelectContent>
								</Select>
							</Field>
						)}
					</form.Field>

					<div className="grid grid-cols-3 gap-3">
						<form.Field name="blind1">
							{(field) => (
								<Field
									error={field.state.meta.errors[0]?.message}
									htmlFor={field.name}
									label="SB"
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
						<form.Field name="blind2">
							{(field) => (
								<Field
									error={field.state.meta.errors[0]?.message}
									htmlFor={field.name}
									label="BB"
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
						<form.Field name="blind3">
							{(field) => (
								<Field
									error={field.state.meta.errors[0]?.message}
									htmlFor={field.name}
									label="Straddle"
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

					<div className="flex gap-3">
						<form.Field name="anteType">
							{(field) => (
								<Field
									className="flex-1"
									htmlFor={field.name}
									label="Ante Type"
								>
									<Select
										onValueChange={(v) => field.handleChange(v)}
										value={field.state.value}
									>
										<SelectTrigger className="w-full" id={field.name}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{ANTE_TYPES.map((at) => (
												<SelectItem key={at.value} value={at.value}>
													{at.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>
							)}
						</form.Field>

						<form.Subscribe
							selector={(state) => state.values.anteType === "none"}
						>
							{(isAnteDisabled) => (
								<form.Field name="ante">
									{(field) => (
										<Field
											className="flex-1"
											error={field.state.meta.errors[0]?.message}
											htmlFor={field.name}
											label="Ante"
										>
											<Input
												disabled={isAnteDisabled}
												id={field.name}
												inputMode="numeric"
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												value={field.state.value}
											/>
										</Field>
									)}
								</form.Field>
							)}
						</form.Subscribe>
					</div>

					<form.Field name="tableSize">
						{(field) => (
							<Field htmlFor={field.name} label="Table Size">
								<Select
									onValueChange={(v) => field.handleChange(v)}
									value={field.state.value}
								>
									<SelectTrigger className="w-full" id={field.name}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{TABLE_SIZES.map((size) => (
											<SelectItem key={size} value={size.toString()}>
												{size}-max
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						)}
					</form.Field>
				</>
			)}
		</>
	);
}
