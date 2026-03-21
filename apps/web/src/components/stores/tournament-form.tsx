import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/utils/trpc";

const GAME_VARIANTS = {
	nlh: { label: "NL Hold'em" },
} as const;

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

interface TournamentFormValues {
	addonAllowed: boolean;
	addonChips?: number;
	addonCost?: number;
	bountyAmount?: number;
	buyIn?: number;
	currencyId?: string;
	entryFee?: number;
	memo?: string;
	name: string;
	rebuyAllowed: boolean;
	rebuyChips?: number;
	rebuyCost?: number;
	startingStack?: number;
	tableSize?: number;
	variant: string;
}

interface TournamentFormProps {
	defaultValues?: TournamentFormValues;
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

export function TournamentForm({
	onSubmit,
	defaultValues,
	isLoading = false,
}: TournamentFormProps) {
	const [rebuyAllowed, setRebuyAllowed] = useState(
		defaultValues?.rebuyAllowed ?? false
	);
	const [addonAllowed, setAddonAllowed] = useState(
		defaultValues?.addonAllowed ?? false
	);

	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);

		const values: TournamentFormValues = {
			name: formData.get("name") as string,
			variant: (formData.get("variant") as string) || "nlh",
			buyIn: parseOptionalInt(formData.get("buyIn") as string),
			entryFee: parseOptionalInt(formData.get("entryFee") as string),
			startingStack: parseOptionalInt(formData.get("startingStack") as string),
			rebuyAllowed,
			rebuyCost: rebuyAllowed
				? parseOptionalInt(formData.get("rebuyCost") as string)
				: undefined,
			rebuyChips: rebuyAllowed
				? parseOptionalInt(formData.get("rebuyChips") as string)
				: undefined,
			addonAllowed,
			addonCost: addonAllowed
				? parseOptionalInt(formData.get("addonCost") as string)
				: undefined,
			addonChips: addonAllowed
				? parseOptionalInt(formData.get("addonChips") as string)
				: undefined,
			bountyAmount: parseOptionalInt(formData.get("bountyAmount") as string),
			tableSize: parseOptionalInt(formData.get("tableSize") as string),
			currencyId: (formData.get("currencyId") as string) || undefined,
			memo: (formData.get("memo") as string) || undefined,
		};

		onSubmit(values);
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<div className="flex flex-col gap-2">
				<Label htmlFor="name">
					Tournament Name <span className="text-destructive">*</span>
				</Label>
				<Input
					defaultValue={defaultValues?.name}
					id="name"
					name="name"
					placeholder="e.g. Sunday Main Event"
					required
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="variant">
					Variant <span className="text-destructive">*</span>
				</Label>
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
			</div>

			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-2">
					<Label htmlFor="buyIn">Buy-In</Label>
					<Input
						defaultValue={defaultValues?.buyIn}
						id="buyIn"
						inputMode="numeric"
						min={0}
						name="buyIn"
						placeholder="0"
						type="number"
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="entryFee">Entry Fee</Label>
					<Input
						defaultValue={defaultValues?.entryFee}
						id="entryFee"
						inputMode="numeric"
						min={0}
						name="entryFee"
						placeholder="0"
						type="number"
					/>
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="startingStack">Starting Stack</Label>
				<Input
					defaultValue={defaultValues?.startingStack}
					id="startingStack"
					inputMode="numeric"
					min={0}
					name="startingStack"
					placeholder="0"
					type="number"
				/>
			</div>

			<div className="flex flex-col gap-2 rounded-md border p-3">
				<div className="flex items-center justify-between">
					<Label htmlFor="rebuyToggle">Rebuy</Label>
					<button
						className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
						data-state={rebuyAllowed ? "checked" : "unchecked"}
						id="rebuyToggle"
						onClick={() => setRebuyAllowed((v) => !v)}
						type="button"
					>
						<span
							className="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
							data-state={rebuyAllowed ? "checked" : "unchecked"}
						/>
					</button>
				</div>
				{rebuyAllowed && (
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-2">
							<Label htmlFor="rebuyCost">Rebuy Cost</Label>
							<Input
								defaultValue={defaultValues?.rebuyCost}
								id="rebuyCost"
								inputMode="numeric"
								min={0}
								name="rebuyCost"
								placeholder="0"
								type="number"
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="rebuyChips">Rebuy Chips</Label>
							<Input
								defaultValue={defaultValues?.rebuyChips}
								id="rebuyChips"
								inputMode="numeric"
								min={0}
								name="rebuyChips"
								placeholder="0"
								type="number"
							/>
						</div>
					</div>
				)}
			</div>

			<div className="flex flex-col gap-2 rounded-md border p-3">
				<div className="flex items-center justify-between">
					<Label htmlFor="addonToggle">Add-on</Label>
					<button
						className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
						data-state={addonAllowed ? "checked" : "unchecked"}
						id="addonToggle"
						onClick={() => setAddonAllowed((v) => !v)}
						type="button"
					>
						<span
							className="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
							data-state={addonAllowed ? "checked" : "unchecked"}
						/>
					</button>
				</div>
				{addonAllowed && (
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-2">
							<Label htmlFor="addonCost">Add-on Cost</Label>
							<Input
								defaultValue={defaultValues?.addonCost}
								id="addonCost"
								inputMode="numeric"
								min={0}
								name="addonCost"
								placeholder="0"
								type="number"
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="addonChips">Add-on Chips</Label>
							<Input
								defaultValue={defaultValues?.addonChips}
								id="addonChips"
								inputMode="numeric"
								min={0}
								name="addonChips"
								placeholder="0"
								type="number"
							/>
						</div>
					</div>
				)}
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="bountyAmount">Bounty Amount</Label>
				<Input
					defaultValue={defaultValues?.bountyAmount}
					id="bountyAmount"
					inputMode="numeric"
					min={0}
					name="bountyAmount"
					placeholder="0"
					type="number"
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="tableSize">Table Size</Label>
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
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="currencyId">Currency</Label>
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
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="memo">Memo</Label>
				<Input
					defaultValue={defaultValues?.memo}
					id="memo"
					name="memo"
					placeholder="Notes about this tournament"
				/>
			</div>

			<Button disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</form>
	);
}
