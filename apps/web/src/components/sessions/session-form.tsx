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
import { TagInput } from "@/components/ui/tag-input";

interface SessionFormValues {
	ante?: number;
	anteType?: string;
	blind1?: number;
	blind2?: number;
	blind3?: number;
	buyIn: number;
	cashOut: number;
	endTime?: string;
	memo?: string;
	sessionDate: string;
	startTime?: string;
	tableSize?: number;
	tagIds?: string[];
	type: "cash_game";
	variant: string;
}

interface SessionFormProps {
	defaultValues?: Partial<SessionFormValues>;
	isLoading?: boolean;
	onCreateTag?: (name: string) => Promise<{ id: string; name: string }>;
	onSubmit: (values: SessionFormValues) => void;
	tags?: Array<{ id: string; name: string }>;
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
	onCreateTag,
	onSubmit,
	tags,
}: SessionFormProps) {
	const [anteType, setAnteType] = useState<string>(
		defaultValues?.anteType ?? "none"
	);
	const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
		defaultValues?.tagIds ?? []
	);

	const isAnteDisabled = anteType === "none";

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);

		const values: SessionFormValues = {
			type: "cash_game",
			sessionDate: formData.get("sessionDate") as string,
			startTime: (formData.get("startTime") as string) || undefined,
			endTime: (formData.get("endTime") as string) || undefined,
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
			tagIds: selectedTagIds,
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

			{/* Start Time / End Time */}
			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-2">
					<Label htmlFor="startTime">Start Time</Label>
					<Input
						defaultValue={defaultValues?.startTime}
						id="startTime"
						name="startTime"
						type="time"
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="endTime">End Time</Label>
					<Input
						defaultValue={defaultValues?.endTime}
						id="endTime"
						name="endTime"
						type="time"
					/>
				</div>
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

			{/* Session Tags */}
			<div className="flex flex-col gap-2">
				<Label>Session Tags</Label>
				<TagInput
					availableTags={tags}
					onAdd={(tag) =>
						setSelectedTagIds((prev) => [...prev, tag.id])
					}
					onCreateTag={onCreateTag}
					onRemove={(tag) =>
						setSelectedTagIds((prev) =>
							prev.filter((id) => id !== tag.id)
						)
					}
					selectedTags={
						selectedTagIds
							.map((id) => tags?.find((t) => t.id === id))
							.filter(
								(t): t is { id: string; name: string } =>
									t !== undefined
							)
					}
				/>
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
