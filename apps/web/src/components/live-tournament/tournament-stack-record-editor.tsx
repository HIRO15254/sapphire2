import { useState } from "react";
import { TournamentAddonSheet } from "@/components/live-tournament/tournament-addon-sheet";
import { TournamentRebuySheet } from "@/components/live-tournament/tournament-rebuy-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TournamentStackRecordPayload {
	addon: { cost: number; chips: number } | null;
	averageStack: number | null;
	rebuy: { cost: number; chips: number } | null;
	remainingPlayers: number | null;
	stackAmount: number;
}

interface TournamentStackRecordEditorProps {
	initialOccurredAt?: string | Date;
	initialPayload: TournamentStackRecordPayload;
	isLoading: boolean;
	maxTime?: Date | null;
	minTime?: Date | null;
	onDelete: () => void;
	onSubmit: (
		payload: TournamentStackRecordPayload,
		occurredAt?: number
	) => void;
}

function toTimeInputValue(value: string | Date): string {
	const date = typeof value === "string" ? new Date(value) : value;
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function applyTimeToDate(original: string | Date, timeStr: string): Date {
	const date = new Date(typeof original === "string" ? original : original);
	const [h, m] = timeStr.split(":").map(Number);
	date.setHours(h ?? 0, m ?? 0);
	return date;
}

function validateTime(
	timeStr: string,
	original: string | Date,
	minTime: Date | null | undefined,
	maxTime: Date | null | undefined
): string | null {
	const newDate = applyTimeToDate(original, timeStr);
	if (minTime && newDate.getTime() < minTime.getTime()) {
		const fmt = `${String(minTime.getHours()).padStart(2, "0")}:${String(minTime.getMinutes()).padStart(2, "0")}`;
		return `Must be after ${fmt}`;
	}
	if (maxTime && newDate.getTime() > maxTime.getTime()) {
		const fmt = `${String(maxTime.getHours()).padStart(2, "0")}:${String(maxTime.getMinutes()).padStart(2, "0")}`;
		return `Must be before ${fmt}`;
	}
	return null;
}

export function TournamentStackRecordEditor({
	initialOccurredAt,
	initialPayload,
	isLoading,
	maxTime,
	minTime,
	onDelete,
	onSubmit,
}: TournamentStackRecordEditorProps) {
	const [stackAmount, setStackAmount] = useState(
		String(initialPayload.stackAmount)
	);
	const [remainingPlayers, setRemainingPlayers] = useState(
		initialPayload.remainingPlayers !== null
			? String(initialPayload.remainingPlayers)
			: ""
	);
	const [averageStack, setAverageStack] = useState(
		initialPayload.averageStack !== null
			? String(initialPayload.averageStack)
			: ""
	);
	const [rebuy, setRebuy] = useState<{ cost: number; chips: number } | null>(
		initialPayload.rebuy
	);
	const [addon, setAddon] = useState<{ cost: number; chips: number } | null>(
		initialPayload.addon
	);
	const [time, setTime] = useState(
		initialOccurredAt ? toTimeInputValue(initialOccurredAt) : ""
	);

	const [rebuySheetOpen, setRebuySheetOpen] = useState(false);
	const [addonSheetOpen, setAddonSheetOpen] = useState(false);

	const handleSave = () => {
		const payload: TournamentStackRecordPayload = {
			stackAmount: Number(stackAmount),
			remainingPlayers: remainingPlayers ? Number(remainingPlayers) : null,
			averageStack: averageStack ? Number(averageStack) : null,
			rebuy,
			addon,
		};
		let occurredAt: number | undefined;
		if (initialOccurredAt && time) {
			const newDate = applyTimeToDate(initialOccurredAt, time);
			occurredAt = Math.floor(newDate.getTime() / 1000);
		}
		onSubmit(payload, occurredAt);
	};

	const timeError =
		initialOccurredAt && time
			? validateTime(time, initialOccurredAt, minTime, maxTime)
			: null;

	return (
		<div className="flex flex-col gap-4">
			{initialOccurredAt && (
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="edit-time">Time</Label>
					<Input
						id="edit-time"
						onChange={(e) => setTime(e.target.value)}
						type="time"
						value={time}
					/>
					{timeError && <p className="text-destructive text-xs">{timeError}</p>}
				</div>
			)}

			<div className="flex flex-col gap-1.5">
				<Label htmlFor="edit-stackAmount">Stack Amount</Label>
				<Input
					id="edit-stackAmount"
					inputMode="numeric"
					min={0}
					onChange={(e) => setStackAmount(e.target.value)}
					required
					type="number"
					value={stackAmount}
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<Label htmlFor="edit-remainingPlayers">Remaining Players</Label>
				<Input
					id="edit-remainingPlayers"
					inputMode="numeric"
					min={1}
					onChange={(e) => setRemainingPlayers(e.target.value)}
					type="number"
					value={remainingPlayers}
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<Label htmlFor="edit-averageStack">Average Stack</Label>
				<Input
					id="edit-averageStack"
					inputMode="numeric"
					min={0}
					onChange={(e) => setAverageStack(e.target.value)}
					type="number"
					value={averageStack}
				/>
			</div>

			{/* Rebuy / Addon */}
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<Label>Rebuy</Label>
					{rebuy ? (
						<div className="flex items-center gap-2">
							<span className="text-muted-foreground text-xs">
								Cost: {rebuy.cost}, Chips: {rebuy.chips}
							</span>
							<Button
								onClick={() => setRebuySheetOpen(true)}
								size="xs"
								type="button"
								variant="ghost"
							>
								Edit
							</Button>
							<Button
								onClick={() => setRebuy(null)}
								size="xs"
								type="button"
								variant="ghost"
							>
								Remove
							</Button>
						</div>
					) : (
						<Button
							onClick={() => setRebuySheetOpen(true)}
							size="xs"
							type="button"
							variant="ghost"
						>
							+ Rebuy
						</Button>
					)}
				</div>
				<div className="flex items-center justify-between">
					<Label>Addon</Label>
					{addon ? (
						<div className="flex items-center gap-2">
							<span className="text-muted-foreground text-xs">
								Cost: {addon.cost}, Chips: {addon.chips}
							</span>
							<Button
								onClick={() => setAddonSheetOpen(true)}
								size="xs"
								type="button"
								variant="ghost"
							>
								Edit
							</Button>
							<Button
								onClick={() => setAddon(null)}
								size="xs"
								type="button"
								variant="ghost"
							>
								Remove
							</Button>
						</div>
					) : (
						<Button
							onClick={() => setAddonSheetOpen(true)}
							size="xs"
							type="button"
							variant="ghost"
						>
							+ Addon
						</Button>
					)}
				</div>
			</div>

			{/* Actions */}
			<div className="flex flex-col gap-2">
				<Button
					disabled={isLoading || timeError !== null}
					onClick={handleSave}
					type="button"
				>
					{isLoading ? "Saving..." : "Save"}
				</Button>
				<Button onClick={onDelete} type="button" variant="destructive">
					Delete
				</Button>
			</div>

			<TournamentRebuySheet
				initialValues={rebuy ?? undefined}
				onDelete={
					rebuy
						? () => {
								setRebuy(null);
								setRebuySheetOpen(false);
							}
						: undefined
				}
				onOpenChange={setRebuySheetOpen}
				onSubmit={(values) => {
					setRebuy(values);
					setRebuySheetOpen(false);
				}}
				open={rebuySheetOpen}
			/>

			<TournamentAddonSheet
				initialValues={addon ?? undefined}
				onDelete={
					addon
						? () => {
								setAddon(null);
								setAddonSheetOpen(false);
							}
						: undefined
				}
				onOpenChange={setAddonSheetOpen}
				onSubmit={(values) => {
					setAddon(values);
					setAddonSheetOpen(false);
				}}
				open={addonSheetOpen}
			/>
		</div>
	);
}
