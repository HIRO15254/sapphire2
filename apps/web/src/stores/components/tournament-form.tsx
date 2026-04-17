import { IconPlus, IconTrash } from "@tabler/icons-react";
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
import { TagInput } from "@/shared/components/ui/tag-input";
import { Textarea } from "@/shared/components/ui/textarea";
import { trpc } from "@/utils/trpc";

const GAME_VARIANTS = {
	nlh: { label: "NL Hold'em" },
} as const;

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export interface TournamentFormValues {
	bountyAmount?: number;
	buyIn?: number;
	chipPurchases: Array<{ name: string; cost: number; chips: number }>;
	currencyId?: string;
	entryFee?: number;
	memo?: string;
	name: string;
	startingStack?: number;
	tableSize?: number;
	tags?: string[];
	variant: string;
}

interface TournamentFormProps {
	defaultValues?: Omit<TournamentFormValues, "tags" | "chipPurchases"> & {
		chipPurchases?: Array<{ name: string; cost: number; chips: number }>;
		tags?: string[];
	};
	isLoading?: boolean;
	onSubmit: (values: TournamentFormValues) => void;
}

const chipPurchaseSchema = z.object({
	name: z.string(),
	cost: z.coerce.number().min(0, "Cost must be 0 or greater"),
	chips: z.coerce.number().min(0, "Chips must be 0 or greater"),
	uid: z.string(),
});

const tournamentFormSchema = z.object({
	name: z
		.string()
		.min(1, "Tournament name is required")
		.max(100, "Tournament name must be 100 characters or less"),
	variant: z.string().min(1, "Variant is required"),
	buyIn: z.coerce.number().min(0, "Must be 0 or greater").optional(),
	entryFee: z.coerce.number().min(0, "Must be 0 or greater").optional(),
	startingStack: z.coerce.number().min(0, "Must be 0 or greater").optional(),
	chipPurchases: z.array(chipPurchaseSchema),
	bountyAmount: z.coerce.number().min(0, "Must be 0 or greater").optional(),
	tableSize: z.coerce.number().min(0, "Must be 0 or greater").optional(),
	currencyId: z.string().optional(),
	memo: z
		.string()
		.max(10_000, "Memo must be 10,000 characters or less")
		.optional(),
	tags: z.array(z.string()).optional(),
});

export function TournamentForm({
	onSubmit,
	defaultValues,
	isLoading = false,
}: TournamentFormProps) {
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];

	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			variant: defaultValues?.variant ?? "nlh",
			buyIn: defaultValues?.buyIn ?? (undefined as number | undefined),
			entryFee: defaultValues?.entryFee ?? (undefined as number | undefined),
			startingStack:
				defaultValues?.startingStack ?? (undefined as number | undefined),
			chipPurchases: (defaultValues?.chipPurchases ?? []).map((cp) => ({
				...cp,
				uid: crypto.randomUUID(),
			})) as Array<{ name: string; cost: number; chips: number; uid: string }>,
			bountyAmount:
				defaultValues?.bountyAmount ?? (undefined as number | undefined),
			tableSize: defaultValues?.tableSize ?? (undefined as number | undefined),
			currencyId: defaultValues?.currencyId ?? "",
			memo: defaultValues?.memo ?? "",
			tags: defaultValues?.tags ?? ([] as string[]),
		},
		onSubmit: ({ value }) => {
			onSubmit({
				name: value.name,
				variant: value.variant || "nlh",
				buyIn: value.buyIn,
				entryFee: value.entryFee,
				startingStack: value.startingStack,
				chipPurchases: value.chipPurchases.map(({ name, cost, chips }) => ({
					name,
					cost,
					chips,
				})),
				bountyAmount: value.bountyAmount,
				tableSize: value.tableSize,
				currencyId: value.currencyId || undefined,
				memo: value.memo || undefined,
				tags: value.tags,
			});
		},
		validators: {
			onSubmit: tournamentFormSchema,
		},
	});

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
						label="Tournament Name"
						required
					>
						<Input
							id={field.name}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="e.g. Sunday Main Event"
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

			<div className="grid grid-cols-2 gap-3">
				<form.Field name="buyIn">
					{(field) => (
						<Field
							error={field.state.meta.errors[0]?.message}
							htmlFor={field.name}
							label="Buy-In"
						>
							<Input
								id={field.name}
								inputMode="numeric"
								min={0}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) =>
									field.handleChange(
										e.target.value === "" ? undefined : Number(e.target.value)
									)
								}
								placeholder="0"
								type="number"
								value={
									field.state.value === undefined
										? ""
										: String(field.state.value)
								}
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
								min={0}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) =>
									field.handleChange(
										e.target.value === "" ? undefined : Number(e.target.value)
									)
								}
								placeholder="0"
								type="number"
								value={
									field.state.value === undefined
										? ""
										: String(field.state.value)
								}
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
						label="Starting Stack"
					>
						<Input
							id={field.name}
							inputMode="numeric"
							min={0}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) =>
								field.handleChange(
									e.target.value === "" ? undefined : Number(e.target.value)
								)
							}
							placeholder="0"
							type="number"
							value={
								field.state.value === undefined ? "" : String(field.state.value)
							}
						/>
					</Field>
				)}
			</form.Field>

			<form.Field name="chipPurchases">
				{(field) => (
					<Field
						className="rounded-md border p-3"
						description="Define optional rebuy or addon structures used during play."
						label="Chip Purchases"
					>
						<div className="flex items-center justify-between">
							<Button
								onClick={() =>
									field.handleChange([
										...field.state.value,
										{ name: "", cost: 0, chips: 0, uid: crypto.randomUUID() },
									])
								}
								size="xs"
								type="button"
								variant="outline"
							>
								<IconPlus size={12} />
								Add
							</Button>
						</div>
						{field.state.value.length > 0 && (
							<div className="flex flex-col gap-2">
								{field.state.value.map((cp, index) => (
									<div className="flex items-end gap-2" key={cp.uid}>
										<Field
											className="flex flex-1 flex-col gap-1"
											htmlFor={`cp-name-${cp.uid}`}
											label="Name"
										>
											<Input
												id={`cp-name-${cp.uid}`}
												onChange={(e) => {
													const updated = field.state.value.map((item, i) =>
														i === index
															? { ...item, name: e.target.value }
															: item
													);
													field.handleChange(updated);
												}}
												placeholder="e.g. Rebuy"
												value={cp.name}
											/>
										</Field>
										<Field
											className="flex w-20 flex-col gap-1"
											htmlFor={`cp-cost-${cp.uid}`}
											label="Cost"
										>
											<Input
												id={`cp-cost-${cp.uid}`}
												inputMode="numeric"
												min={0}
												onChange={(e) => {
													const parsed = Number.parseInt(e.target.value, 10);
													const updated = field.state.value.map((item, i) =>
														i === index
															? {
																	...item,
																	cost: Number.isNaN(parsed) ? 0 : parsed,
																}
															: item
													);
													field.handleChange(updated);
												}}
												placeholder="0"
												type="number"
												value={cp.cost}
											/>
										</Field>
										<Field
											className="flex w-20 flex-col gap-1"
											htmlFor={`cp-chips-${cp.uid}`}
											label="Chips"
										>
											<Input
												id={`cp-chips-${cp.uid}`}
												inputMode="numeric"
												min={0}
												onChange={(e) => {
													const parsed = Number.parseInt(e.target.value, 10);
													const updated = field.state.value.map((item, i) =>
														i === index
															? {
																	...item,
																	chips: Number.isNaN(parsed) ? 0 : parsed,
																}
															: item
													);
													field.handleChange(updated);
												}}
												placeholder="0"
												type="number"
												value={cp.chips}
											/>
										</Field>
										<Button
											aria-label="Remove chip purchase"
											onClick={() => {
												field.handleChange(
													field.state.value.filter((_, i) => i !== index)
												);
											}}
											size="icon-xs"
											type="button"
											variant="ghost"
										>
											<IconTrash size={12} />
										</Button>
									</div>
								))}
							</div>
						)}
					</Field>
				)}
			</form.Field>

			<form.Field name="bountyAmount">
				{(field) => (
					<Field
						error={field.state.meta.errors[0]?.message}
						htmlFor={field.name}
						label="Bounty Amount"
					>
						<Input
							id={field.name}
							inputMode="numeric"
							min={0}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(e) =>
								field.handleChange(
									e.target.value === "" ? undefined : Number(e.target.value)
								)
							}
							placeholder="0"
							type="number"
							value={
								field.state.value === undefined ? "" : String(field.state.value)
							}
						/>
					</Field>
				)}
			</form.Field>

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
							placeholder="Notes about this tournament"
							rows={4}
							value={field.state.value ?? ""}
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
							placeholder="Add a tag"
							selectedTags={field.state.value.map((name) => ({
								id: name,
								name,
							}))}
						/>
					</Field>
				)}
			</form.Field>

			<form.Subscribe>
				{(state) => (
					<Button
						disabled={isLoading || !state.canSubmit || state.isSubmitting}
						type="submit"
					>
						{isLoading || state.isSubmitting ? "Saving..." : "Save"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
