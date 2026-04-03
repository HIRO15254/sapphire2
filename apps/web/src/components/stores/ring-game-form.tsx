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
import { Textarea } from "@/components/ui/textarea";
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

function parseOptionalInt(value: string): number | undefined {
	if (!value) {
		return undefined;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? undefined : parsed;
}

export function RingGameForm({
	onSubmit,
	defaultValues,
	isLoading = false,
}: RingGameFormProps) {
	const [anteType, setAnteType] = useState<string>(
		defaultValues?.anteType ?? "none"
	);

	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];

	const variant = (defaultValues?.variant ??
		"nlh") as keyof typeof GAME_VARIANTS;
	const blindLabels = GAME_VARIANTS[variant]?.blindLabels ?? {
		blind1: "SB",
		blind2: "BB",
		blind3: "Straddle",
	};

	const isAnteDisabled = anteType === "none";

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);

		const values: RingGameFormValues = {
			name: formData.get("name") as string,
			variant: (formData.get("variant") as string) || "nlh",
			blind1: parseOptionalInt(formData.get("blind1") as string),
			blind2: parseOptionalInt(formData.get("blind2") as string),
			blind3: parseOptionalInt(formData.get("blind3") as string),
			ante: isAnteDisabled
				? undefined
				: parseOptionalInt(formData.get("ante") as string),
			anteType: ((formData.get("anteType") as string) || undefined) as
				| "all"
				| "bb"
				| "none"
				| undefined,
			minBuyIn: parseOptionalInt(formData.get("minBuyIn") as string),
			maxBuyIn: parseOptionalInt(formData.get("maxBuyIn") as string),
			tableSize: parseOptionalInt(formData.get("tableSize") as string),
			currencyId: (formData.get("currencyId") as string) || undefined,
			memo: (formData.get("memo") as string) || undefined,
		};

		onSubmit(values);
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<Field htmlFor="name" label="Game Name" required>
				<Input
					defaultValue={defaultValues?.name}
					id="name"
					name="name"
					placeholder="e.g. 1/2 NLH"
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

			<div className="grid grid-cols-3 gap-3">
				<Field htmlFor="blind1" label={blindLabels.blind1}>
					<Input
						defaultValue={defaultValues?.blind1}
						id="blind1"
						inputMode="numeric"
						min={0}
						name="blind1"
						placeholder="0"
						type="number"
					/>
				</Field>
				<Field htmlFor="blind2" label={blindLabels.blind2}>
					<Input
						defaultValue={defaultValues?.blind2}
						id="blind2"
						inputMode="numeric"
						min={0}
						name="blind2"
						placeholder="0"
						type="number"
					/>
				</Field>
				<Field htmlFor="blind3" label={blindLabels.blind3}>
					<Input
						defaultValue={defaultValues?.blind3}
						id="blind3"
						inputMode="numeric"
						min={0}
						name="blind3"
						placeholder="0"
						type="number"
					/>
				</Field>
			</div>

			<div className="flex gap-3">
				<Field className="flex-1" htmlFor="anteType" label="Ante Type">
					<Select
						defaultValue={defaultValues?.anteType ?? "none"}
						name="anteType"
						onValueChange={setAnteType}
					>
						<SelectTrigger className="w-full" id="anteType">
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

				<Field className="flex-1" htmlFor="ante" label="Ante">
					<Input
						defaultValue={defaultValues?.ante}
						disabled={isAnteDisabled}
						id="ante"
						inputMode="numeric"
						min={0}
						name="ante"
						placeholder="0"
						type="number"
					/>
				</Field>
			</div>

			<div className="grid grid-cols-2 gap-3">
				<Field htmlFor="minBuyIn" label="Min Buy-In">
					<Input
						defaultValue={defaultValues?.minBuyIn}
						id="minBuyIn"
						inputMode="numeric"
						min={0}
						name="minBuyIn"
						placeholder="0"
						type="number"
					/>
				</Field>
				<Field htmlFor="maxBuyIn" label="Max Buy-In">
					<Input
						defaultValue={defaultValues?.maxBuyIn}
						id="maxBuyIn"
						inputMode="numeric"
						min={0}
						name="maxBuyIn"
						placeholder="0"
						type="number"
					/>
				</Field>
			</div>

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
					placeholder="Notes about this game"
					rows={4}
				/>
			</Field>

			<Button disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</form>
	);
}
