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

interface SessionFormValues {
	ante?: number;
	anteType?: string;
	blind1?: number;
	blind2?: number;
	blind3?: number;
	buyIn: number;
	cashOut: number;
	endedAt?: string;
	maxBuyIn?: number;
	memo?: string;
	minBuyIn?: number;
	sessionDate: string;
	// Time + memo
	startedAt?: string;
	tableSize?: number;
	type: "cash_game";
	// Ring game config
	variant: string;
}

interface SessionFormProps {
	defaultValues?: Partial<SessionFormValues>;
	isLoading?: boolean;
	onSubmit: (values: SessionFormValues) => void;
}

const ANTE_TYPES = [
	{ value: "none", label: "No Ante" },
	{ value: "bb", label: "BB Ante" },
	{ value: "all", label: "All Ante" },
] as const;

const TABLE_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

function getTodayDateString(): string {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, "0");
	const day = String(today.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function parseOptionalInt(value: string): number | undefined {
	if (!value) {
		return undefined;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? undefined : parsed;
}

export function SessionForm({
	defaultValues,
	isLoading = false,
	onSubmit,
}: SessionFormProps) {
	const [anteType, setAnteType] = useState<string>(
		defaultValues?.anteType ?? "none"
	);

	const isAnteDisabled = anteType === "none";

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);

		const values: SessionFormValues = {
			type: "cash_game",
			sessionDate: formData.get("sessionDate") as string,
			buyIn: Number(formData.get("buyIn")),
			cashOut: Number(formData.get("cashOut")),
			variant: (formData.get("variant") as string) || "nlh",
			blind1: parseOptionalInt(formData.get("blind1") as string),
			blind2: parseOptionalInt(formData.get("blind2") as string),
			blind3: parseOptionalInt(formData.get("blind3") as string),
			ante: isAnteDisabled
				? undefined
				: parseOptionalInt(formData.get("ante") as string),
			anteType: (formData.get("anteType") as string) || undefined,
			tableSize: parseOptionalInt(formData.get("tableSize") as string),
			minBuyIn: parseOptionalInt(formData.get("minBuyIn") as string),
			maxBuyIn: parseOptionalInt(formData.get("maxBuyIn") as string),
			startedAt: (formData.get("startedAt") as string) || undefined,
			endedAt: (formData.get("endedAt") as string) || undefined,
			memo: (formData.get("memo") as string) || undefined,
		};

		onSubmit(values);
	};

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			{/* Session Date */}
			<div className="flex flex-col gap-2">
				<Label htmlFor="sessionDate">
					Session Date <span className="text-destructive">*</span>
				</Label>
				<Input
					defaultValue={defaultValues?.sessionDate ?? getTodayDateString()}
					id="sessionDate"
					name="sessionDate"
					required
					type="date"
				/>
			</div>

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

			{/* Min Buy-In / Max Buy-In */}
			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-2">
					<Label htmlFor="minBuyIn">Min Buy-In</Label>
					<Input
						defaultValue={defaultValues?.minBuyIn}
						id="minBuyIn"
						inputMode="numeric"
						min={0}
						name="minBuyIn"
						placeholder="0"
						type="number"
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="maxBuyIn">Max Buy-In</Label>
					<Input
						defaultValue={defaultValues?.maxBuyIn}
						id="maxBuyIn"
						inputMode="numeric"
						min={0}
						name="maxBuyIn"
						placeholder="0"
						type="number"
					/>
				</div>
			</div>

			{/* Start Time / End Time */}
			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-2">
					<Label htmlFor="startedAt">Start Time</Label>
					<Input
						defaultValue={defaultValues?.startedAt}
						id="startedAt"
						name="startedAt"
						type="datetime-local"
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="endedAt">End Time</Label>
					<Input
						defaultValue={defaultValues?.endedAt}
						id="endedAt"
						name="endedAt"
						type="datetime-local"
					/>
				</div>
			</div>

			{/* Memo */}
			<div className="flex flex-col gap-2">
				<Label htmlFor="memo">Memo</Label>
				<textarea
					className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					defaultValue={defaultValues?.memo}
					id="memo"
					name="memo"
					placeholder="Notes about this session"
				/>
			</div>

			<Button disabled={isLoading} type="submit">
				{isLoading ? "Saving..." : "Save"}
			</Button>
		</form>
	);
}
