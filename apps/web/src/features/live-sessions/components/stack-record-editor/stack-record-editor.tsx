import { AllInBottomSheet } from "@/features/live-sessions/components/all-in-bottom-sheet";
import { EventBadge } from "@/features/live-sessions/components/event-badge";
import {
	StackBadgeRow,
	StackEditorActionRow,
	StackNumberField,
	StackSectionHeader,
	StackTimeField,
} from "@/features/live-sessions/components/stack-ui";
import { Button } from "@/shared/components/ui/button";
import { useStackRecordEditor } from "./use-stack-record-editor";

interface StackRecordPayload {
	allIns: Array<{
		equity: number;
		potSize: number;
		trials: number;
		wins: number;
	}>;
	stackAmount: number;
}

interface StackRecordEditorProps {
	initialOccurredAt?: string | Date;
	initialPayload: StackRecordPayload;
	isLoading: boolean;
	maxTime?: Date | null;
	minTime?: Date | null;
	onSubmit: (payload: StackRecordPayload, occurredAt?: number) => void;
}

export function StackRecordEditor({
	initialOccurredAt,
	initialPayload,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
}: StackRecordEditorProps) {
	const {
		stackAmount,
		setStackAmount,
		allIns,
		time,
		setTime,
		allInSheetOpen,
		setAllInSheetOpen,
		editingAllIn,
		setEditingAllIn,
		handleAllInSubmit,
		handleAllInDelete,
		handleSave,
		timeError,
	} = useStackRecordEditor({
		initialOccurredAt,
		initialPayload,
		maxTime,
		minTime,
		onSubmit,
	});

	return (
		<div className="flex flex-col gap-4">
			{initialOccurredAt && (
				<StackTimeField error={timeError} onChange={setTime} value={time} />
			)}

			<StackNumberField
				id="edit-stackAmount"
				inputMode="numeric"
				label="Stack Amount"
				min={0}
				onChange={setStackAmount}
				required
				type="number"
				value={stackAmount}
			/>

			<div className="flex flex-col gap-2">
				<StackSectionHeader
					action={
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
					}
					title="All-ins"
				/>
				{allIns.length > 0 ? (
					<StackBadgeRow className="pb-0">
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
					</StackBadgeRow>
				) : null}
			</div>

			<StackEditorActionRow
				isLoading={isLoading}
				onSave={handleSave}
				saveDisabled={timeError !== null}
			/>

			<AllInBottomSheet
				initialValues={editingAllIn ?? undefined}
				onDelete={editingAllIn === null ? undefined : handleAllInDelete}
				onOpenChange={setAllInSheetOpen}
				onSubmit={handleAllInSubmit}
				open={allInSheetOpen}
			/>
		</div>
	);
}
