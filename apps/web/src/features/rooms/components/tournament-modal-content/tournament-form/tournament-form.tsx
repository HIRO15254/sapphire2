import { ChipPurchasesEditor } from "@/features/rooms/components/chip-purchases-editor";
import type { TournamentFormValues } from "@/features/rooms/hooks/use-tournaments";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { TagInput } from "@/shared/components/ui/tag-input";
import { Textarea } from "@/shared/components/ui/textarea";
import { VariantSelect } from "@/shared/components/variant-select";
import { useTournamentForm } from "./use-tournament-form";

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

interface TournamentFormProps {
	defaultValues?: Omit<TournamentFormValues, "tags" | "chipPurchases"> & {
		chipPurchases?: Array<{ name: string; cost: number; chips: number }>;
		tags?: string[];
	};
	/**
	 * Stable id assigned to the `<form>` element so an external Save button
	 * (e.g. the surrounding FormSheet toolbar) can submit it via the HTML
	 * `form` attribute. The form renders no submit button of its own.
	 */
	formId: string;
	/**
	 * Called when a submit attempt fails validation. Lets the surrounding modal
	 * reveal this (Details) tab so the user sees the errors instead of a
	 * seemingly dead Save button on another tab (SA2-97 follow-up).
	 */
	onInvalidSubmit?: () => void;
	/**
	 * Registers a getter for the form's current values so AI auto-fill can
	 * merge over what the user has already entered.
	 */
	onRegisterLiveValues?: (
		getter: () => Omit<TournamentFormValues, "tags" | "chipPurchases"> & {
			chipPurchases?: Array<{ name: string; cost: number; chips: number }>;
			tags?: string[];
		}
	) => void;
	onSubmit: (values: TournamentFormValues) => void;
	/**
	 * Live variant changes, so the surrounding modal can keep the Structure
	 * tab's blind labels in sync with the Details tab's picker.
	 */
	onVariantChange?: (variant: string) => void;
}

export function TournamentForm({
	onSubmit,
	defaultValues,
	formId,
	onInvalidSubmit,
	onRegisterLiveValues,
	onVariantChange,
}: TournamentFormProps) {
	const { form, currencies, onScopeChange, onVariantFieldChange, scopeOf } =
		useTournamentForm({
			defaultValues,
			onInvalidSubmit,
			onRegisterLiveValues,
			onSubmit,
			onVariantChange,
		});

	return (
		<form
			className="flex flex-col gap-4"
			id={formId}
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="name">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Tournament name"
						required
					>
						<Input
							id={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<form.Field name="variant">
				{(field) => {
					const scope = scopeOf(field.state.value);
					return (
						<>
							<Field label="Variant scope">
								<RadioGroup
									className="flex flex-col gap-1"
									onValueChange={(v) =>
										onScopeChange(v as "all" | "perLevel", field.state.value)
									}
									value={scope}
								>
									<label
										className="flex items-center gap-2 py-1 text-sm"
										htmlFor="tournament-scope-all"
									>
										<RadioGroupItem id="tournament-scope-all" value="all" />
										Same variant for all levels
									</label>
									<label
										className="flex items-center gap-2 py-1 text-sm"
										htmlFor="tournament-scope-per-level"
									>
										<RadioGroupItem
											id="tournament-scope-per-level"
											value="perLevel"
										/>
										Choose games per level
									</label>
								</RadioGroup>
							</Field>
							{scope === "all" ? (
								<Field htmlFor={field.name} label="Variant" required>
									<VariantSelect
										id={field.name}
										includeMix
										onChange={onVariantFieldChange}
										value={field.state.value}
									/>
								</Field>
							) : (
								<p className="text-muted-foreground text-xs">
									Assign each level's games in the Structure tab.
								</p>
							)}
						</>
					);
				}}
			</form.Field>

			<div className="grid grid-cols-2 gap-3">
				<form.Field name="buyIn">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Buy-in"
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
							label="Entry fee"
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

			<form.Field name="startingStack">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Starting stack"
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

			<form.Field name="chipPurchases">
				{(field) => (
					<ChipPurchasesEditor
						onChange={(rows) => field.handleChange(rows)}
						value={field.state.value}
					/>
				)}
			</form.Field>

			<form.Field name="bountyAmount">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Bounty amount"
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

			<form.Field name="tableSize">
				{(field) => (
					<Field htmlFor={field.name} label="Table size">
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

			<form.Field name="currencyId">
				{(field) => (
					<Field htmlFor={field.name} label="Currency">
						<Select
							onValueChange={(v) => field.handleChange(v)}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{currencies.map((c) => (
									<SelectItem key={c.id} value={c.id}>
										{c.name}
										{c.unit ? ` (${c.unit})` : ""}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>

			<form.Field name="memo">
				{(field) => (
					<Field htmlFor={field.name} label="Memo">
						<Textarea
							id={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
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
									field.state.value.filter((t) => t !== tag.name)
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
		</form>
	);
}
