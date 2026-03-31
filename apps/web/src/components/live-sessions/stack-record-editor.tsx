import { useState } from "react";
import { AddonBottomSheet } from "@/components/live-sessions/addon-bottom-sheet";
import { AllInBottomSheet } from "@/components/live-sessions/all-in-bottom-sheet";
import { EventBadge } from "@/components/live-sessions/event-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AllIn {
	equity: number;
	id: number;
	potSize: number;
	trials: number;
	wins: number;
}

interface StackRecordPayload {
	addon: { amount: number } | null;
	allIns: Array<{
		equity: number;
		potSize: number;
		trials: number;
		wins: number;
	}>;
	stackAmount: number;
}

interface StackRecordEditorProps {
	initialPayload: StackRecordPayload;
	isLoading: boolean;
	onDelete: () => void;
	onSubmit: (payload: StackRecordPayload) => void;
}

export function StackRecordEditor({
	initialPayload,
	isLoading,
	onDelete,
	onSubmit,
}: StackRecordEditorProps) {
	const [stackAmount, setStackAmount] = useState(
		String(initialPayload.stackAmount)
	);
	const [allIns, setAllIns] = useState<AllIn[]>(() =>
		initialPayload.allIns.map((ai, i) => ({ ...ai, id: i + 1 }))
	);
	const [addon, setAddon] = useState<{ amount: number } | null>(
		initialPayload.addon
	);

	const [allInSheetOpen, setAllInSheetOpen] = useState(false);
	const [editingAllIn, setEditingAllIn] = useState<AllIn | null>(null);
	const [addonSheetOpen, setAddonSheetOpen] = useState(false);
	const [editingAddon, setEditingAddon] = useState(false);

	let nextId = allIns.length > 0 ? Math.max(...allIns.map((a) => a.id)) : 0;

	const handleAllInSubmit = (values: {
		potSize: number;
		trials: number;
		equity: number;
		wins: number;
	}) => {
		if (editingAllIn === null) {
			nextId += 1;
			setAllIns((prev) => [...prev, { ...values, id: nextId }]);
		} else {
			setAllIns((prev) =>
				prev.map((item) =>
					item.id === editingAllIn.id ? { ...values, id: item.id } : item
				)
			);
		}
		setAllInSheetOpen(false);
		setEditingAllIn(null);
	};

	const handleAllInDelete = () => {
		if (editingAllIn !== null) {
			setAllIns((prev) => prev.filter((item) => item.id !== editingAllIn.id));
		}
		setAllInSheetOpen(false);
		setEditingAllIn(null);
	};

	const handleAddonSubmit = (values: { amount: number }) => {
		setAddon(values);
		setAddonSheetOpen(false);
		setEditingAddon(false);
	};

	const handleAddonDelete = () => {
		setAddon(null);
		setAddonSheetOpen(false);
		setEditingAddon(false);
	};

	const handleSave = () => {
		onSubmit({
			stackAmount: Number(stackAmount),
			allIns: allIns.map(({ potSize, trials, equity, wins }) => ({
				potSize,
				trials,
				equity,
				wins,
			})),
			addon,
		});
	};

	return (
		<div className="flex flex-col gap-4">
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

			{/* All-ins */}
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<Label>All-ins</Label>
					<Button
						onClick={() => {
							setEditingAllIn(null);
							setAllInSheetOpen(true);
						}}
						size="xs"
						type="button"
						variant="ghost"
					>
						+ All-in
					</Button>
				</div>
				{allIns.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
						{allIns.map((allIn) => (
							<EventBadge
								data={{
									potSize: allIn.potSize,
									trials: allIn.trials,
									equity: allIn.equity,
									wins: allIn.wins,
								}}
								key={allIn.id}
								onEdit={() => {
									setEditingAllIn(allIn);
									setAllInSheetOpen(true);
								}}
								type="all-in"
							/>
						))}
					</div>
				)}
			</div>

			{/* Addon */}
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<Label>Addon</Label>
					{addon === null ? (
						<Button
							onClick={() => {
								setEditingAddon(false);
								setAddonSheetOpen(true);
							}}
							size="xs"
							type="button"
							variant="ghost"
						>
							+ Addon
						</Button>
					) : (
						<EventBadge
							data={{ amount: addon.amount }}
							onEdit={() => {
								setEditingAddon(true);
								setAddonSheetOpen(true);
							}}
							type="addon"
						/>
					)}
				</div>
			</div>

			{/* Actions */}
			<div className="flex flex-col gap-2">
				<Button disabled={isLoading} onClick={handleSave} type="button">
					{isLoading ? "Saving..." : "Save"}
				</Button>
				<Button onClick={onDelete} type="button" variant="destructive">
					Delete
				</Button>
			</div>

			<AllInBottomSheet
				initialValues={editingAllIn ?? undefined}
				onDelete={editingAllIn !== null ? handleAllInDelete : undefined}
				onOpenChange={setAllInSheetOpen}
				onSubmit={handleAllInSubmit}
				open={allInSheetOpen}
			/>

			<AddonBottomSheet
				initialAmount={editingAddon && addon ? addon.amount : undefined}
				onDelete={editingAddon ? handleAddonDelete : undefined}
				onOpenChange={setAddonSheetOpen}
				onSubmit={handleAddonSubmit}
				open={addonSheetOpen}
			/>
		</div>
	);
}
