import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SelectWithClear,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import type { useRingGameForm } from "../use-ring-game-form";

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
type RingGameFormState = ReturnType<typeof useRingGameForm>;

type LimitsFieldsProps = Pick<RingGameFormState, "currencies" | "form">;

export function LimitsFields({ currencies, form }: LimitsFieldsProps) {
	return (
		<>
			<div className="grid grid-cols-2 gap-3">
				<form.Field name="minBuyIn">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Min buy-in"
						>
							<Input
								id={field.name}
								inputMode="numeric"
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
				<form.Field name="maxBuyIn">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Max buy-in"
						>
							<Input
								id={field.name}
								inputMode="numeric"
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
			</div>

			<form.Field name="tableSize">
				{(field) => (
					<Field htmlFor={field.name} label="Table size">
						<SelectWithClear
							onValueChange={(value) => field.handleChange(value ?? "")}
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
						</SelectWithClear>
					</Field>
				)}
			</form.Field>

			<form.Field name="currencyId">
				{(field) => (
					<Field htmlFor={field.name} label="Currency">
						<SelectWithClear
							onValueChange={(value) => field.handleChange(value ?? "")}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{currencies.map((currency) => (
									<SelectItem key={currency.id} value={currency.id}>
										{currency.name}
										{currency.unit ? ` (${currency.unit})` : ""}
									</SelectItem>
								))}
							</SelectContent>
						</SelectWithClear>
					</Field>
				)}
			</form.Field>

			<form.Field name="memo">
				{(field) => (
					<Field htmlFor={field.name} label="Memo">
						<Textarea
							id={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							rows={4}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>
		</>
	);
}
