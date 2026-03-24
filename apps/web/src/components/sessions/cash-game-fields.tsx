import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface CashGameFieldsProps {
	defaultValues?: {
		ante?: number;
		anteType?: string;
		blind1?: number;
		blind2?: number;
		blind3?: number;
		buyIn?: number;
		cashOut?: number;
		tableSize?: number;
		variant?: string;
	};
}

const ANTE_TYPES = [
	{ value: "none", label: "No Ante" },
	{ value: "bb", label: "BB Ante" },
	{ value: "all", label: "All Ante" },
] as const;

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function CashGameFields({ defaultValues }: CashGameFieldsProps) {
	const [anteType, setAnteType] = useState<string>(
		defaultValues?.anteType ?? "none"
	);

	const isAnteDisabled = anteType === "none";

	return (
		<>
			{/* Buy-in / Cash-out */}
			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-2">
					<Label htmlFor="buyIn">
						Buy-in <span className="text-destructive">*</span>
					</Label>
					<Input
						defaultValue={defaultValues?.buyIn}
						id="buyIn"
						inputMode="numeric"
						min={0}
						name="buyIn"
						placeholder="0"
						required
						type="number"
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="cashOut">
						Cash-out <span className="text-destructive">*</span>
					</Label>
					<Input
						defaultValue={defaultValues?.cashOut}
						id="cashOut"
						inputMode="numeric"
						min={0}
						name="cashOut"
						placeholder="0"
						required
						type="number"
					/>
				</div>
			</div>

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
