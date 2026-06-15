import { IconAdjustments } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import type { UseSessionWizardReturn } from "../use-session-wizard";
import { RoomGameSelectors } from "./link-selectors";

export function MasterStepBody({
	state,
	rooms,
	isLiveLinked,
}: {
	state: UseSessionWizardReturn;
	rooms?: Array<{ id: string; name: string }>;
	isLiveLinked: boolean;
}) {
	return (
		<>
			<Field label="Session type">
				<Tabs
					onValueChange={(value) =>
						state.setSessionType(value as "cash_game" | "tournament")
					}
					value={state.sessionType}
				>
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger disabled={isLiveLinked} value="cash_game">
							Cash game
						</TabsTrigger>
						<TabsTrigger disabled={isLiveLinked} value="tournament">
							Tournament
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</Field>
			<RoomGameSelectors
				gameLabel={state.gameLabel}
				gameOptions={state.gameOptions}
				isLiveLinked={isLiveLinked}
				onGameChange={state.handleGameChange}
				onRoomChange={state.handleRoomChange}
				rooms={rooms}
				selectedGameId={state.selectedGameId}
				selectedRoomId={state.selectedRoomId}
			/>
			{state.canCustomizeRules && (
				<Button
					className="self-start"
					onClick={state.customizeRules}
					type="button"
					variant="outline"
				>
					<IconAdjustments size={16} />
					Customize rules
				</Button>
			)}
		</>
	);
}
