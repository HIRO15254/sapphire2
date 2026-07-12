import type { RingGameFormValues } from "@/features/rooms/hooks/use-ring-games";
import { MixFormSheet } from "@/shared/components/mix-form-sheet";
import { MixGamesEditor } from "@/shared/components/mix-games-editor";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { VariantSelect } from "@/shared/components/variant-select";
import { useVariantLabels } from "@/shared/hooks/use-variant-labels";
import { ANTE_TYPE_OPTIONS } from "@/shared/lib/ante-types";
import { BlindFields } from "./blind-fields";
import { useRingGameForm } from "./use-ring-game-form";

type AnteType = "all" | "bb" | "none";

interface RingGameFormProps {
	defaultValues?: RingGameFormValues;
	/**
	 * Stable id assigned to the `<form>` element so an external Save button
	 * (e.g. the surrounding FormSheet toolbar) can submit it via the HTML
	 * `form` attribute. The form renders no submit button of its own.
	 */
	formId: string;
	onSubmit: (values: RingGameFormValues) => void;
}

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

function VariantAwareBlindFields({
	form,
	variant,
}: {
	form: ReturnType<typeof useRingGameForm>["form"];
	variant: string;
}) {
	const blindLabels = useVariantLabels(variant || "nlh");
	return <BlindFields blindLabels={blindLabels} form={form} />;
}

export function RingGameForm({
	onSubmit,
	defaultValues,
	formId,
}: RingGameFormProps) {
	const {
		form,
		currencies,
		editingMix,
		groupFor,
		isMixSheetOpen,
		isMixValue,
		mixRowFor,
		onEditMix,
		onMixSaved,
		onVariantChange,
		setIsMixSheetOpen,
		variants,
	} = useRingGameForm({
		defaultValues,
		onSubmit,
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
						label="Game name"
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
				{(field) => (
					<Field htmlFor={field.name} label="Variant" required>
						<VariantSelect
							id={field.name}
							includeMix
							onChange={onVariantChange}
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			{/* Mix games swap the flat blind/ante fields for the group editor:
			    amounts only — the composition follows the mix master, edited via
			    the dedicated bottom sheet (updates the master itself). */}
			<form.Subscribe selector={(state) => state.values.variant}>
				{(variant) =>
					isMixValue(variant) ? (
						<>
							<form.Field name="mixGames">
								{(field) => (
									<MixGamesEditor
										onChange={(rows) => field.handleChange(rows)}
										onEditMix={
											mixRowFor(variant) ? () => onEditMix(variant) : undefined
										}
										resolveGroup={groupFor}
										value={field.state.value}
									/>
								)}
							</form.Field>
							<MixFormSheet
								editingMix={editingMix}
								key={editingMix ? `edit-${editingMix.id}` : "closed"}
								onOpenChange={setIsMixSheetOpen}
								onSaved={onMixSaved}
								open={isMixSheetOpen}
								variants={variants}
							/>
						</>
					) : (
						<>
							<VariantAwareBlindFields form={form} variant={variant} />
							<div className="flex gap-3">
								<form.Field name="anteType">
									{(field) => (
										<Field
											className="flex-1"
											htmlFor={field.name}
											label="Ante type"
										>
											<Select
												onValueChange={(v) => field.handleChange(v as AnteType)}
												value={field.state.value}
											>
												<SelectTrigger className="w-full" id={field.name}>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{ANTE_TYPE_OPTIONS.map((at) => (
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
						</>
					)
				}
			</form.Subscribe>

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
								onChange={(e) => field.handleChange(e.target.value)}
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
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</Field>
					)}
				</form.Field>
			</div>

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
		</form>
	);
}
