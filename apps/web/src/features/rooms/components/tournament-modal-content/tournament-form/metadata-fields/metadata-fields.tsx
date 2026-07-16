import { Field } from "@/shared/components/ui/field";
import {
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SelectWithClear,
} from "@/shared/components/ui/select";
import { TagInput } from "@/shared/components/ui/tag-input";
import { Textarea } from "@/shared/components/ui/textarea";
import type { useTournamentForm } from "../use-tournament-form";

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
type TournamentFormState = ReturnType<typeof useTournamentForm>;
type MetadataFieldsProps = Pick<TournamentFormState, "currencies" | "form">;

export function MetadataFields({ currencies, form }: MetadataFieldsProps) {
	return (
		<>
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

			<form.Field name="tags">
				{(field) => (
					<Field label="Tags">
						<TagInput
							onAdd={(tag) =>
								field.handleChange(
									field.state.value.includes(tag.name)
										? field.state.value
										: [...field.state.value, tag.name]
								)
							}
							onCreateTag={async (name) => ({ id: name, name })}
							onRemove={(tag) =>
								field.handleChange(
									field.state.value.filter((value) => value !== tag.name)
								)
							}
							selectedTags={field.state.value.map((name) => ({
								id: name,
								name,
							}))}
						/>
					</Field>
				)}
			</form.Field>
		</>
	);
}
