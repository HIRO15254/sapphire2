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
import { useTournamentModalContent } from "./use-tournament-modal-content";

export type TournamentPartialFormValues = Omit<
	TournamentFormValues,
	"tags" | "chipPurchases"
> & {
	chipPurchases?: Array<{ name: string; cost: number; chips: number }>;
	tags?: string[];
};

interface TournamentModalContentProps {
	/** Form id shared with the surrounding FormSheet's Save button. */
	formId: string;
	initialBlindLevels: BlindLevelRow[];
	initialFormValues?: TournamentPartialFormValues;
	/** Opens the AI auto-fill sheet (body button). Omitted disables it. */
	onOpenAi?: () => void;
	/**
	 * Registers a getter that returns the form's current values so AI auto-fill
	 * merges over what the user has already entered instead of overwriting it.
	 */
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
	const { localBlindLevels, setLocalBlindLevels } = useTournamentModalContent({
		initialBlindLevels,
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
			<Tabs defaultValue="details">
				<TabsList className="w-full">
					<TabsTrigger value="details">Details</TabsTrigger>
					<TabsTrigger value="structure">Structure</TabsTrigger>
				</TabsList>
				{/*
				 * forceMount keeps the `<form id={formId}>` in the DOM while the
				 * Structure tab is active. Otherwise Radix unmounts this panel and
				 * the FormSheet Save button (which submits via `form={formId}`)
				 * resolves nothing, so saving silently fails from the Structure tab
				 * (SA2-97). `data-[state=inactive]:hidden` hides it while inactive
				 * since forceMount renders inactive content without the `hidden` attr.
				 */}
				<TabsContent
					className="data-[state=inactive]:hidden"
					forceMount
					value="details"
				>
					<TournamentForm
						defaultValues={initialFormValues}
						formId={formId}
						onRegisterLiveValues={onRegisterLiveValues}
						onSubmit={(values) => onSave(values, localBlindLevels)}
					/>
				</TabsContent>
				<TabsContent value="structure">
					<LocalBlindStructureContent
						onChange={setLocalBlindLevels}
						value={localBlindLevels}
						variant={initialFormValues?.variant ?? "nlh"}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}
