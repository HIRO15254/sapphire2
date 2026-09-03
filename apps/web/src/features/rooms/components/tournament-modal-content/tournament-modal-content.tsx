import { IconSparkles } from "@tabler/icons-react";
import { LocalBlindStructureContent } from "@/features/rooms/components/blind-level-editor";
import { TournamentForm } from "@/features/rooms/components/tournament-modal-content/tournament-form";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import type { TournamentFormValues } from "@/features/rooms/hooks/use-tournaments";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/components/ui/tabs";
import {
	type TournamentModalTab,
	useTournamentModalContent,
} from "./use-tournament-modal-content";

export type TournamentPartialFormValues = Omit<
	TournamentFormValues,
	"tags" | "chipPurchases"
> & {
	chipPurchases?: Array<{ name: string; cost: number; chips: number }>;
	tags?: string[];
};

interface TournamentModalContentProps {
	formId: string;
	initialBlindLevels: BlindLevelRow[];
	initialFormValues?: TournamentPartialFormValues;
	onOpenAi?: () => void;
	onRegisterLiveValues?: (getter: () => TournamentPartialFormValues) => void;
	onSave: (
		values: TournamentFormValues,
		levels: BlindLevelRow[]
	) => void | Promise<void>;
}

export function TournamentModalContent({
	formId,
	initialBlindLevels,
	initialFormValues,
	onOpenAi,
	onRegisterLiveValues,
	onSave,
}: TournamentModalContentProps) {
	const {
		localBlindLevels,
		setLocalBlindLevels,
		activeTab,
		setActiveTab,
		structureVariant,
		handleStructureVariantChange,
	} = useTournamentModalContent({
		initialBlindLevels,
		initialVariant: initialFormValues?.variant,
	});

	return (
		<div className="flex flex-col gap-3">
			{onOpenAi ? (
				<Button
					className="self-start"
					onClick={onOpenAi}
					size="sm"
					type="button"
					variant="outline"
				>
					<IconSparkles size={14} />
					Auto-fill with AI
					<Badge className="px-1 py-0 text-[10px]" variant="secondary">
						beta
					</Badge>
				</Button>
			) : null}
			<Tabs
				onValueChange={(value) => setActiveTab(value as TournamentModalTab)}
				value={activeTab}
			>
				<TabsList className="w-full">
					<TabsTrigger value="details">Details</TabsTrigger>
					<TabsTrigger value="structure">Structure</TabsTrigger>
				</TabsList>
				<TabsContent
					className="data-[state=inactive]:hidden"
					forceMount
					value="details"
				>
					<TournamentForm
						defaultValues={initialFormValues}
						formId={formId}
						onInvalidSubmit={() => setActiveTab("details")}
						onRegisterLiveValues={onRegisterLiveValues}
						onSubmit={(values) => onSave(values, localBlindLevels)}
						onVariantChange={handleStructureVariantChange}
					/>
				</TabsContent>
				<TabsContent value="structure">
					<LocalBlindStructureContent
						onChange={setLocalBlindLevels}
						value={localBlindLevels}
						variant={structureVariant}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}
