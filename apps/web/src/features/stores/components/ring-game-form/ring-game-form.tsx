import type { RingGameFormValues } from "@/features/stores/hooks/use-ring-games";
import { Button } from "@/shared/components/ui/button";
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
import { useRingGameForm } from "./use-ring-game-form";

const GAME_VARIANTS = {
	nlh: {
		label: "NL Hold'em",
		blindLabels: { blind1: "SB", blind2: "BB", blind3: "Straddle" },
	},
} as const;

type Variant = keyof typeof GAME_VARIANTS;

type AnteType = "all" | "bb" | "none";

interface RingGameFormProps {
	defaultValues?: RingGameFormValues;
	isLoading?: boolean;
	onSubmit: (values: RingGameFormValues) => void;
}

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const ANTE_TYPES = [
	{ value: "none", label: "No Ante" },
	{ value: "bb", label: "BB Ante" },
	{ value: "all", label: "All Ante" },
] as const;

export function RingGameForm({
	onSubmit,
	defaultValues,
	isLoading = false,
}: RingGameFormProps) {
	const { form, currencies } = useRingGameForm({ defaultValues, onSubmit });

	const variantKey = (defaultValues?.variant ?? "nlh") as Variant;
	const blindLabels = GAME_VARIANTS[variantKey]?.blindLabels ?? {
		blind1: "SB",
		blind2: "BB",
		blind3: "Straddle",
	};

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="name">
				{(field) => (
					<Field
						description="例: 1/2 NLH"
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Game Name"
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
						<Select
							onValueChange={(v) => field.handleChange(v)}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue placeholder="Select variant" />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(GAME_VARIANTS).map(([key, val]) => (
									<SelectItem key={key} value={key}>
										{val.label}
									</SelectItem>
								))}
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
							label={blindLabels.blind1}
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
							label={blindLabels.blind2}
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
							label={blindLabels.blind3}
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
						<Field className="flex-1" htmlFor={field.name} label="Ante Type">
							<Select
								onValueChange={(v) => field.handleChange(v as AnteType)}
								value={field.state.value}
							>
								<SelectTrigger className="w-full" id={field.name}>
									<SelectValue placeholder="Select ante type" />
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

				<form.Subscribe selector={(state) => state.values.anteType === "none"}>
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

			<div className="grid grid-cols-2 gap-3">
				<form.Field name="minBuyIn">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Min Buy-In"
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
							label="Max Buy-In"
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
					<Field htmlFor={field.name} label="Table Size">
						<Select
							onValueChange={(v) => field.handleChange(v)}
							value={field.state.value}
						>
							<SelectTrigger className="w-full" id={field.name}>
								<SelectValue placeholder="Select table size" />
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
								<SelectValue placeholder="Select currency" />
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

			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
			>
				{([canSubmit, isSubmitting]) => (
					<Button
						disabled={isLoading || !canSubmit || isSubmitting}
						type="submit"
					>
						{isLoading ? "Saving..." : "Save"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
