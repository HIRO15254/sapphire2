import { useState } from "react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";

interface CashGameFieldsProps {
	currencies?: Array<{ id: string; name: string }>;
	defaultValues?: {
		ante?: number;
		anteType?: string;
		blind1?: number;
		blind2?: number;
		blind3?: number;
		tableSize?: number;
		variant?: string;
	};
	onCurrencyChange?: (id: string | undefined) => void;
	selectedCurrencyId?: string;
}

const NONE_VALUE = "__none__";

const ANTE_TYPES = [
	{ value: "none", label: "No Ante" },
	{ value: "bb", label: "BB Ante" },
	{ value: "all", label: "All Ante" },
] as const;

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function CashGameFields({
	currencies,
	defaultValues,
	onCurrencyChange,
	selectedCurrencyId,
}: CashGameFieldsProps) {
	const [anteType, setAnteType] = useState<string>(
		defaultValues?.anteType ?? "none"
	);

	const isAnteDisabled = anteType === "none";

	return (
		<>
			{/* Currency Selector */}
			{currencies && currencies.length > 0 && (
				<div className="flex flex-col gap-2">
					<Label>Currency</Label>
					<Select
						onValueChange={(v) =>
							onCurrencyChange?.(v === NONE_VALUE ? undefined : v)
						}
						value={selectedCurrencyId ?? NONE_VALUE}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select a currency" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={NONE_VALUE}>None</SelectItem>
							{currencies.map((c) => (
								<SelectItem key={c.id} value={c.id}>
									{c.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="text-muted-foreground text-xs">
						Auto-generates a transaction with the session&apos;s P&L.
					</p>
				</div>
			)}

			{/* Variant */}
			<div className="flex flex-col gap-2">
				<Label htmlFor="variant">Variant</Label>
				<Select defaultValue={defaultValues?.variant ?? "nlh"} name="variant">
					<SelectTrigger className="w-full" id="variant">
						<SelectValue placeholder="Select variant" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="nlh">NL Hold&apos;em</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* SB / BB / Straddle */}
			<div className="grid grid-cols-3 gap-3">
				<div className="flex flex-col gap-2">
					<Label htmlFor="blind1">SB</Label>
					<Input
						defaultValue={defaultValues?.blind1}
						id="blind1"
						inputMode="numeric"
						min={0}
						name="blind1"
						placeholder="0"
						type="number"
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="blind2">BB</Label>
					<Input
						defaultValue={defaultValues?.blind2}
						id="blind2"
						inputMode="numeric"
						min={0}
						name="blind2"
						placeholder="0"
						type="number"
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="blind3">Straddle</Label>
					<Input
						defaultValue={defaultValues?.blind3}
						id="blind3"
						inputMode="numeric"
						min={0}
						name="blind3"
						placeholder="0"
						type="number"
					/>
				</div>
			</div>

			{/* Ante Type / Ante */}
			<div className="flex gap-3">
				<div className="flex flex-1 flex-col gap-2">
					<Label htmlFor="anteType">Ante Type</Label>
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
				</div>
				<div className="flex flex-1 flex-col gap-2">
					<Label htmlFor="ante">Ante</Label>
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
				</div>
			</div>

			{/* Table Size */}
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
		</>
	);
}
