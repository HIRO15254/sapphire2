import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { TagInput } from "@/components/ui/tag-input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/utils/trpc";

const GAME_VARIANTS = {
	nlh: { label: "NL Hold'em" },
} as const;

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

interface ChipPurchaseFormItem {
	chips: number;
	cost: number;
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

function parseOptionalInt(value: string): number | undefined {
	if (!value) {
		return undefined;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? undefined : parsed;
}

function emptyChipPurchase(): ChipPurchaseFormItem {
	return { name: "", cost: 0, chips: 0, uid: crypto.randomUUID() };
}

export function TournamentForm({
	onSubmit,
	defaultValues,
	isLoading = false,
}: TournamentFormProps) {
	const [tags, setTags] = useState<string[]>(defaultValues?.tags ?? []);
	const [chipPurchases, setChipPurchases] = useState<ChipPurchaseFormItem[]>(
		() =>
			(defaultValues?.chipPurchases ?? []).map((cp) => ({
				...cp,
				uid: crypto.randomUUID(),
			}))
	);

	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];

	const addChipPurchase = () => {
		setChipPurchases((prev) => [...prev, emptyChipPurchase()]);
	};

	const removeChipPurchase = (index: number) => {
		setChipPurchases((prev) => prev.filter((_, i) => i !== index));
	};

	const updateChipPurchase = (
		index: number,
		field: keyof ChipPurchaseFormItem,
		value: string
	) => {
		setChipPurchases((prev) =>
			prev.map((cp, i) => {
				if (i !== index) {
					return cp;
				}
				if (field === "name") {
					return { ...cp, name: value };
				}
				const parsed = Number.parseInt(value, 10);
				return { ...cp, [field]: Number.isNaN(parsed) ? 0 : parsed };
			})
		);
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);

		const values: TournamentFormValues = {
			name: formData.get("name") as string,
			variant: (formData.get("variant") as string) || "nlh",
			buyIn: parseOptionalInt(formData.get("buyIn") as string),
			entryFee: parseOptionalInt(formData.get("entryFee") as string),
			startingStack: parseOptionalInt(formData.get("startingStack") as string),
			chipPurchases: chipPurchases.map((cp) => ({
				name: cp.name,
				cost: cp.cost,
				chips: cp.chips,
			})),
			bountyAmount: parseOptionalInt(formData.get("bountyAmount") as string),
			tableSize: parseOptionalInt(formData.get("tableSize") as string),
			currencyId: (formData.get("currencyId") as string) || undefined,
			memo: (formData.get("memo") as string) || undefined,
			tags,
		};

		onSubmit(values);
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<Field htmlFor="name" label="Tournament Name" required>
				<Input
					defaultValue={defaultValues?.name}
					id="name"
					name="name"
					placeholder="e.g. Sunday Main Event"
					required
				/>
			</Field>

			<Field htmlFor="variant" label="Variant" required>
				<Select defaultValue={defaultValues?.variant ?? "nlh"} name="variant">
					<SelectTrigger className="w-full" id="variant">
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

			<div className="grid grid-cols-2 gap-3">
				<Field htmlFor="buyIn" label="Buy-In">
					<Input
						defaultValue={defaultValues?.buyIn}
						id="buyIn"
						inputMode="numeric"
						min={0}
						name="buyIn"
						placeholder="0"
						type="number"
					/>
				</Field>
				<Field htmlFor="entryFee" label="Entry Fee">
					<Input
						defaultValue={defaultValues?.entryFee}
						id="entryFee"
						inputMode="numeric"
						min={0}
						name="entryFee"
						placeholder="0"
						type="number"
					/>
				</Field>
			</div>

			<Field htmlFor="startingStack" label="Starting Stack">
				<Input
					defaultValue={defaultValues?.startingStack}
					id="startingStack"
					inputMode="numeric"
					min={0}
					name="startingStack"
					placeholder="0"
					type="number"
				/>
			</Field>

			<Field
				className="rounded-md border p-3"
				description="Define optional rebuy or addon structures used during play."
				label="Chip Purchases"
			>
				<div className="flex items-center justify-between">
					<Button
						onClick={addChipPurchase}
						size="xs"
						type="button"
						variant="outline"
					>
						<IconPlus size={12} />
						Add
					</Button>
				</div>
				{chipPurchases.length > 0 && (
					<div className="flex flex-col gap-2">
						{chipPurchases.map((cp, index) => (
							<div className="flex items-end gap-2" key={cp.uid}>
								<Field
									className="flex flex-1 flex-col gap-1"
									htmlFor={`cp-name-${index}`}
									label="Name"
								>
									<Input
										id={`cp-name-${index}`}
										onChange={(e) =>
											updateChipPurchase(index, "name", e.target.value)
										}
										placeholder="e.g. Rebuy"
										value={cp.name}
									/>
								</Field>
								<Field
									className="flex w-20 flex-col gap-1"
									htmlFor={`cp-cost-${index}`}
									label="Cost"
								>
									<Input
										id={`cp-cost-${index}`}
										inputMode="numeric"
										min={0}
										onChange={(e) =>
											updateChipPurchase(index, "cost", e.target.value)
										}
										placeholder="0"
										type="number"
										value={cp.cost}
									/>
								</Field>
								<Field
									className="flex w-20 flex-col gap-1"
									htmlFor={`cp-chips-${index}`}
									label="Chips"
								>
									<Input
										id={`cp-chips-${index}`}
										inputMode="numeric"
										min={0}
										onChange={(e) =>
											updateChipPurchase(index, "chips", e.target.value)
										}
										placeholder="0"
										type="number"
										value={cp.chips}
									/>
								</Field>
								<Button
									aria-label="Remove chip purchase"
									onClick={() => removeChipPurchase(index)}
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

			<Field htmlFor="bountyAmount" label="Bounty Amount">
				<Input
					defaultValue={defaultValues?.bountyAmount}
					id="bountyAmount"
					inputMode="numeric"
					min={0}
					name="bountyAmount"
					placeholder="0"
					type="number"
				/>
			</Field>

			<Field htmlFor="tableSize" label="Table Size">
				<Select
					defaultValue={defaultValues?.tableSize?.toString()}
					name="tableSize"
				>
					<SelectTrigger className="w-full" id="tableSize">
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

			<Field htmlFor="currencyId" label="Currency">
				<Select defaultValue={defaultValues?.currencyId} name="currencyId">
					<SelectTrigger className="w-full" id="currencyId">
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

			<Field htmlFor="memo" label="Memo">
				<Textarea
					defaultValue={defaultValues?.memo}
					id="memo"
					name="memo"
					placeholder="Notes about this tournament"
					rows={4}
				/>
			</Field>

			<Field label="Tags">
				<TagInput
					onAdd={(tag) =>
						setTags((prev) =>
							prev.includes(tag.name) ? prev : [...prev, tag.name]
						)
					}
					onCreateTag={async (name) => ({ id: name, name })}
					onRemove={(tag) =>
						setTags((prev) => prev.filter((t) => t !== tag.name))
					}
					placeholder="Add a tag"
					selectedTags={tags.map((name) => ({ id: name, name }))}
				/>
			</Field>

			<Button disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</form>
	);
}
