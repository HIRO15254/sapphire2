import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
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
import { optionalNumericString } from "@/shared/lib/form-fields";
import { trpc } from "@/utils/trpc";

const GAME_VARIANTS = {
	nlh: { label: "NL Hold'em" },
} as const;

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

interface ChipPurchaseFormItem {
	chips: string;
	cost: string;
	name: string;
	uid: string;
}

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

function numStrOrEmpty(value: number | undefined): string {
	return value === undefined ? "" : String(value);
}

function parseOptInt(value: string): number | undefined {
	if (value === "") {
		return undefined;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCostInt(value: string): number {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : 0;
}

const chipPurchaseItemSchema = z.object({
	name: z.string(),
	cost: z.string(),
	chips: z.string(),
	uid: z.string(),
});

const tournamentFormSchema = z.object({
	name: z.string().min(1, "Tournament name is required"),
	variant: z.string(),
	buyIn: optionalNumericString({ integer: true, min: 0 }),
	entryFee: optionalNumericString({ integer: true, min: 0 }),
	startingStack: optionalNumericString({ integer: true, min: 0 }),
	bountyAmount: optionalNumericString({ integer: true, min: 0 }),
	tableSize: z.string(),
	currencyId: z.string(),
	memo: z.string(),
	tags: z.array(z.string()),
	chipPurchases: z.array(chipPurchaseItemSchema),
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
			buyIn: numStrOrEmpty(defaultValues?.buyIn),
			entryFee: numStrOrEmpty(defaultValues?.entryFee),
			startingStack: numStrOrEmpty(defaultValues?.startingStack),
			bountyAmount: numStrOrEmpty(defaultValues?.bountyAmount),
			tableSize: defaultValues?.tableSize?.toString() ?? "",
			currencyId: defaultValues?.currencyId ?? "",
			memo: defaultValues?.memo ?? "",
			tags: defaultValues?.tags ?? [],
			chipPurchases: (defaultValues?.chipPurchases ?? []).map((cp) => ({
				name: cp.name,
				cost: String(cp.cost),
				chips: String(cp.chips),
				uid: crypto.randomUUID(),
			})) as ChipPurchaseFormItem[],
		},
		onSubmit: ({ value }) => {
			onSubmit({
				name: value.name,
				variant: value.variant || "nlh",
				buyIn: parseOptInt(value.buyIn),
				entryFee: parseOptInt(value.entryFee),
				startingStack: parseOptInt(value.startingStack),
				chipPurchases: value.chipPurchases.map((cp) => ({
					name: cp.name,
					cost: parseCostInt(cp.cost),
					chips: parseCostInt(cp.chips),
				})),
				bountyAmount: parseOptInt(value.bountyAmount),
				tableSize: parseOptInt(value.tableSize),
				currencyId: value.currencyId || undefined,
				memo: value.memo ? value.memo : undefined,
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
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="0"
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
								placeholder="0"
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
						label="Starting Stack"
					>
						<Input
							id={field.name}
							inputMode="numeric"
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="0"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

			<form.Field mode="array" name="chipPurchases">
				{(field) => (
					<Field
						className="rounded-md border p-3"
						description="Define optional rebuy or addon structures used during play."
						label="Chip Purchases"
					>
						<div className="flex items-center justify-between">
							<Button
								onClick={() =>
									field.pushValue({
										name: "",
										cost: "0",
										chips: "0",
										uid: crypto.randomUUID(),
									})
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
										<form.Field name={`chipPurchases[${index}].name`}>
											{(sub) => (
												<Field
													className="flex flex-1 flex-col gap-1"
													htmlFor={`cp-name-${index}`}
													label="Name"
												>
													<Input
														id={`cp-name-${index}`}
														onChange={(e) => sub.handleChange(e.target.value)}
														placeholder="e.g. Rebuy"
														value={sub.state.value}
													/>
												</Field>
											)}
										</form.Field>
										<form.Field name={`chipPurchases[${index}].cost`}>
											{(sub) => (
												<Field
													className="flex w-20 flex-col gap-1"
													htmlFor={`cp-cost-${index}`}
													label="Cost"
												>
													<Input
														id={`cp-cost-${index}`}
														inputMode="numeric"
														onChange={(e) => sub.handleChange(e.target.value)}
														placeholder="0"
														value={sub.state.value}
													/>
												</Field>
											)}
										</form.Field>
										<form.Field name={`chipPurchases[${index}].chips`}>
											{(sub) => (
												<Field
													className="flex w-20 flex-col gap-1"
													htmlFor={`cp-chips-${index}`}
													label="Chips"
												>
													<Input
														id={`cp-chips-${index}`}
														inputMode="numeric"
														onChange={(e) => sub.handleChange(e.target.value)}
														placeholder="0"
														value={sub.state.value}
													/>
												</Field>
											)}
										</form.Field>
										<Button
											aria-label="Remove chip purchase"
											onClick={() => field.removeValue(index)}
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
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="0"
							value={field.state.value}
						/>
					</Field>
				)}
			</form.Field>

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
							placeholder="Notes about this tournament"
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
							placeholder="Add a tag"
							selectedTags={field.state.value.map((name) => ({
								id: name,
								name,
							}))}
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
