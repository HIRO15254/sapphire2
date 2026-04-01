import { useState } from "react";
import { EventBadge } from "@/components/live-sessions/event-badge";
import { TournamentAddonSheet } from "@/components/live-tournament/tournament-addon-sheet";
import { TournamentRebuySheet } from "@/components/live-tournament/tournament-rebuy-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTournamentFormContext } from "@/routes/active-session";

interface TournamentStackFormProps {
	isLoading: boolean;
	onComplete: () => void;
	onSubmit: (values: {
		addon: { cost: number; chips: number } | null;
		averageStack: number | null;
		rebuy: { cost: number; chips: number } | null;
		remainingPlayers: number | null;
		stackAmount: number;
	}) => void;
}

export function TournamentStackForm({
	isLoading,
	onComplete,
	onSubmit,
}: TournamentStackFormProps) {
	const {
		state,
		setStackAmount,
		setRemainingPlayers,
		setAverageStack,
		setRebuy,
		setAddon,
	} = useTournamentFormContext();
	const { stackAmount, remainingPlayers, averageStack, rebuy, addon } = state;

	const [rebuySheetOpen, setRebuySheetOpen] = useState(false);
	const [addonSheetOpen, setAddonSheetOpen] = useState(false);

	const handleRebuySubmit = (values: { cost: number; chips: number }) => {
		setRebuy(values);
		setRebuySheetOpen(false);
	};

	const handleRebuyDelete = () => {
		setRebuy(null);
		setRebuySheetOpen(false);
	};

	const handleAddonSubmit = (values: { cost: number; chips: number }) => {
		setAddon(values);
		setAddonSheetOpen(false);
	};

	const handleAddonDelete = () => {
		setAddon(null);
		setAddonSheetOpen(false);
	};

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		onSubmit({
			stackAmount: Number(stackAmount),
			remainingPlayers: remainingPlayers ? Number(remainingPlayers) : null,
			averageStack: averageStack ? Number(averageStack) : null,
			rebuy,
			addon,
		});

		// Reset rebuy/addon after submit, but keep stack fields
		setRebuy(null);
		setAddon(null);
	};

	return (
		<div className="flex flex-col gap-2">
			{/* Row 1: Event badges */}
			{(rebuy || addon) && (
				<div className="flex gap-1.5 overflow-x-auto pb-1">
					{rebuy && (
						<EventBadge
							data={{ cost: rebuy.cost, chips: rebuy.chips }}
							onEdit={() => setRebuySheetOpen(true)}
							type="rebuy"
						/>
					)}
					{addon && (
						<EventBadge
							data={{ cost: addon.cost, chips: addon.chips }}
							onEdit={() => setAddonSheetOpen(true)}
							type="tournament-addon"
						/>
					)}
				</div>
			)}

			{/* Row 2: Stack input + optional fields */}
			<form className="flex flex-col gap-2" onSubmit={handleSubmit}>
				<div className="flex items-center gap-2">
					<Input
						className="flex-1"
						inputMode="numeric"
						min={0}
						onChange={(e) => setStackAmount(e.target.value)}
						placeholder="Stack"
						required
						type="number"
						value={stackAmount}
					/>
					<Button disabled={isLoading} size="sm" type="submit">
						{isLoading ? "..." : "Update"}
					</Button>
					<Button
						onClick={onComplete}
						size="sm"
						type="button"
						variant="outline"
					>
						End
					</Button>
				</div>

				<div className="flex items-center gap-2">
					<Input
						className="flex-1"
						inputMode="numeric"
						min={1}
						onChange={(e) => setRemainingPlayers(e.target.value)}
						placeholder="Remaining"
						type="number"
						value={remainingPlayers}
					/>
					<Input
						className="flex-1"
						inputMode="numeric"
						min={0}
						onChange={(e) => setAverageStack(e.target.value)}
						placeholder="Avg Stack"
						type="number"
						value={averageStack}
					/>
				</div>
			</form>

			{/* Row 3: +Rebuy +Addon buttons */}
			<div className="flex gap-2">
				<Button
					onClick={() => setRebuySheetOpen(true)}
					size="xs"
					type="button"
					variant="ghost"
				>
					+ Rebuy
				</Button>
				<Button
					onClick={() => setAddonSheetOpen(true)}
					size="xs"
					type="button"
					variant="ghost"
				>
					+ Addon
				</Button>
			</div>

			{/* Bottom sheets */}
			<TournamentRebuySheet
				initialValues={rebuy ?? undefined}
				onDelete={rebuy ? handleRebuyDelete : undefined}
				onOpenChange={setRebuySheetOpen}
				onSubmit={handleRebuySubmit}
				open={rebuySheetOpen}
			/>

			<TournamentAddonSheet
				initialValues={addon ?? undefined}
				onDelete={addon ? handleAddonDelete : undefined}
				onOpenChange={setAddonSheetOpen}
				onSubmit={handleAddonSubmit}
				open={addonSheetOpen}
			/>
		</div>
	);
}
