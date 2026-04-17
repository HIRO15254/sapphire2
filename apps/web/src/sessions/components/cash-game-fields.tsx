import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";

export interface CashGameFieldsProps {
	ante?: number;
	anteType?: string;
	blind1?: number;
	blind2?: number;
	blind3?: number;
	currencies?: Array<{ id: string; name: string }>;
	onAnteChange?: (value: number | undefined) => void;
	onAnteTypeChange?: (value: string) => void;
	onBlind1Change?: (value: number | undefined) => void;
	onBlind2Change?: (value: number | undefined) => void;
	onBlind3Change?: (value: number | undefined) => void;
	onCurrencyChange?: (id: string | undefined) => void;
	onTableSizeChange?: (value: number | undefined) => void;
	onVariantChange?: (value: string) => void;
	selectedCurrencyId?: string;
	tableSize?: number;
	variant?: string;
}

const NONE_VALUE = "__none__";

const ANTE_TYPES = [
	{ value: "none", label: "No Ante" },
	{ value: "bb", label: "BB Ante" },
	{ value: "all", label: "All Ante" },
] as const;

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

function parseNumericInput(value: string): number | undefined {
	if (!value) return undefined;
	const parsed = Number.parseFloat(value);
	return Number.isNaN(parsed) ? undefined : parsed;
}

export function CashGameFields({
	ante,
	anteType = "none",
	blind1,
	blind2,
	blind3,
	currencies,
	onAnteChange,
	onAnteTypeChange,
	onBlind1Change,
	onBlind2Change,
	onBlind3Change,
	onCurrencyChange,
	onTableSizeChange,
	onVariantChange,
	selectedCurrencyId,
	tableSize,
	variant = "nlh",
}: CashGameFieldsProps) {
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
				<Select
					onValueChange={(v) => onVariantChange?.(v)}
					value={variant}
				>
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
						id="blind1"
						inputMode="numeric"
						min={0}
						onChange={(e) => onBlind1Change?.(parseNumericInput(e.target.value))}
						placeholder="0"
						type="number"
						value={blind1 ?? ""}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="blind2">BB</Label>
					<Input
						id="blind2"
						inputMode="numeric"
						min={0}
						onChange={(e) => onBlind2Change?.(parseNumericInput(e.target.value))}
						placeholder="0"
						type="number"
						value={blind2 ?? ""}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="blind3">Straddle</Label>
					<Input
						id="blind3"
						inputMode="numeric"
						min={0}
						onChange={(e) => onBlind3Change?.(parseNumericInput(e.target.value))}
						placeholder="0"
						type="number"
						value={blind3 ?? ""}
					/>
				</div>
			</div>

			{/* Ante Type / Ante */}
			<div className="flex gap-3">
				<div className="flex flex-1 flex-col gap-2">
					<Label htmlFor="anteType">Ante Type</Label>
					<Select
						onValueChange={(v) => onAnteTypeChange?.(v)}
						value={anteType}
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
						disabled={isAnteDisabled}
						id="ante"
						inputMode="numeric"
						min={0}
						onChange={(e) => onAnteChange?.(parseNumericInput(e.target.value))}
						placeholder="0"
						type="number"
						value={isAnteDisabled ? "" : (ante ?? "")}
					/>
				</div>
			</div>

			{/* Table Size */}
			<div className="flex flex-col gap-2">
				<Label htmlFor="tableSize">Table Size</Label>
				<Select
					onValueChange={(v) =>
						onTableSizeChange?.(v === NONE_VALUE ? undefined : Number(v))
					}
					value={tableSize?.toString() ?? NONE_VALUE}
				>
					<SelectTrigger className="w-full" id="tableSize">
						<SelectValue placeholder="Select table size" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={NONE_VALUE}>None</SelectItem>
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
