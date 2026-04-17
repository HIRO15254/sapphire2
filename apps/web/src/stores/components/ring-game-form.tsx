import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import z from "zod";
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
import { trpc } from "@/utils/trpc";

const GAME_VARIANTS = {
	nlh: {
		label: "NL Hold'em",
		blindLabels: { blind1: "SB", blind2: "BB", blind3: "Straddle" },
	},
} as const;

interface RingGameFormValues {
	ante?: number;
	anteType?: "all" | "bb" | "none";
	blind1?: number;
	blind2?: number;
	blind3?: number;
	currencyId?: string;
	maxBuyIn?: number;
	memo?: string;
	minBuyIn?: number;
	name: string;
	tableSize?: number;
	variant: string;
}

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

const ringGameFormSchema = z.object({
	name: z
		.string()
		.min(1, "Game name is required")
		.max(100, "Game name must be 100 characters or less"),
	variant: z.string().min(1, "Variant is required"),
	blind1: z.coerce.number().nonnegative("Blind 1 must be non-negative").optional(),
	blind2: z.coerce.number().nonnegative("Blind 2 must be non-negative").optional(),
	blind3: z.coerce.number().nonnegative("Blind 3 must be non-negative").optional(),
	ante: z.coerce.number().nonnegative("Ante must be non-negative").optional(),
	anteType: z.enum(["none", "bb", "all"]).optional(),
	minBuyIn: z.coerce.number().nonnegative("Min Buy-In must be non-negative").optional(),
	maxBuyIn: z.coerce.number().nonnegative("Max Buy-In must be non-negative").optional(),
	tableSize: z.coerce.number().nonnegative("Table size must be non-negative").optional(),
	currencyId: z.string().optional(),
	memo: z.string().max(10_000, "Memo must be 10,000 characters or less").optional(),
});

export function RingGameForm({
	onSubmit,
	defaultValues,
	isLoading = false,
}: RingGameFormProps) {
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];

	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			variant: defaultValues?.variant ?? "nlh",
			blind1: defaultValues?.blind1 ?? undefined,
			blind2: defaultValues?.blind2 ?? undefined,
			blind3: defaultValues?.blind3 ?? undefined,
			ante: defaultValues?.ante ?? undefined,
			anteType: defaultValues?.anteType ?? "none",
			minBuyIn: defaultValues?.minBuyIn ?? undefined,
			maxBuyIn: defaultValues?.maxBuyIn ?? undefined,
			tableSize: defaultValues?.tableSize ?? undefined,
			currencyId: defaultValues?.currencyId ?? "",
			memo: defaultValues?.memo ?? "",
		},
		onSubmit: ({ value }) => {
			onSubmit({
				name: value.name,
				variant: value.variant || "nlh",
				blind1: value.blind1,
				blind2: value.blind2,
				blind3: value.blind3,
				ante: value.anteType === "none" ? undefined : value.ante,
				anteType: (value.anteType as "all" | "bb" | "none" | undefined) || undefined,
				minBuyIn: value.minBuyIn,
				maxBuyIn: value.maxBuyIn,
				tableSize: value.tableSize,
				currencyId: value.currencyId || undefined,
				memo: value.memo || undefined,
			});
		},
		validators: {
			onSubmit: ringGameFormSchema,
		},
	});

	const blindLabels = GAME_VARIANTS[
		form.getFieldValue("variant") as keyof typeof GAME_VARIANTS
	]?.blindLabels ?? {
		blind1: "SB",
		blind2: "BB",
		blind3: "Straddle",
	};

	const anteType = form.getFieldValue("anteType");
	const isAnteDisabled = anteType === "none";

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
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Game Name"
						required
					>
						<Input
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="e.g. 1/2 NLH"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<form.Field name="variant">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Variant"
						required
					>
						<Select
							name={field.name}
							onValueChange={(value) => field.handleChange(value)}
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
								min={0}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) =>
									field.handleChange(e.target.value === "" ? undefined : Number(e.target.value))
								}
								placeholder="0"
								type="number"
								value={field.state.value ?? ""}
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
								min={0}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) =>
									field.handleChange(e.target.value === "" ? undefined : Number(e.target.value))
								}
								placeholder="0"
								type="number"
								value={field.state.value ?? ""}
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
								min={0}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) =>
									field.handleChange(e.target.value === "" ? undefined : Number(e.target.value))
								}
								placeholder="0"
								type="number"
								value={field.state.value ?? ""}
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
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Ante Type"
						>
							<Select
								name={field.name}
								onValueChange={(value) => field.handleChange(value)}
								value={field.state.value ?? "none"}
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
								min={0}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) =>
									field.handleChange(e.target.value === "" ? undefined : Number(e.target.value))
								}
								placeholder="0"
								type="number"
								value={field.state.value ?? ""}
							/>
						</Field>
					)}
				</form.Field>
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
								min={0}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) =>
									field.handleChange(e.target.value === "" ? undefined : Number(e.target.value))
								}
								placeholder="0"
								type="number"
								value={field.state.value ?? ""}
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
								min={0}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) =>
									field.handleChange(e.target.value === "" ? undefined : Number(e.target.value))
								}
								placeholder="0"
								type="number"
								value={field.state.value ?? ""}
							/>
						</Field>
					)}
				</form.Field>
			</div>

			<form.Field name="tableSize">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Table Size"
					>
						<Select
							name={field.name}
							onValueChange={(value) =>
								field.handleChange(value === "" ? undefined : Number(value))
							}
							value={(field.state.value ?? "").toString()}
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
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Currency"
					>
						<Select
							name={field.name}
							onValueChange={(value) => field.handleChange(value)}
							value={field.state.value ?? ""}
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
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Memo"
					>
						<Textarea
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="Notes about this game"
							rows={4}
							value={field.state.value ?? ""}
						/>
					</Field>
				)}
			</form.Field>

			<form.Subscribe>
				{(state) => (
					<Button disabled={isLoading || !state.canSubmit || state.isSubmitting} type="submit">
						{isLoading || state.isSubmitting ? "Saving..." : "Save"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
