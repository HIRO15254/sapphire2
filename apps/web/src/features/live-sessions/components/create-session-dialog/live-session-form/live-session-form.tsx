import { MasterStepBody } from "@/features/sessions/components/session-wizard/master-step-body";
import { RulesStepBody } from "@/features/sessions/components/session-wizard/rules-step-body";
import { StartStepBody } from "@/features/sessions/components/session-wizard/start-step-body";
import type {
	RingGameOption,
	SessionFormValues,
	TournamentOption,
} from "@/features/sessions/utils/session-form-helpers";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { useLiveSessionForm } from "./use-live-session-form";

interface LiveSessionFormProps {
	currencies?: Array<{ id: string; name: string }>;
	/** Stable id the FormSheet toolbar's submit button targets via `form`. */
	formId: string;
	onRoomChange?: (roomId: string | undefined) => void;
	onSubmit: (values: SessionFormValues) => void;
	ringGames?: RingGameOption[];
	rooms?: Array<{ id: string; name: string }>;
	tournaments?: TournamentOption[];
}

/**
 * Single-screen "Start Live Session" form. The master (type / room / game)
 * and the start-critical field (initial buy-in or blind timer) sit up top;
 * rule overrides are tucked into a collapsible "Customize rules" section so a
 * session that keeps the master's rules starts without extra navigation.
 */
export function LiveSessionForm({
	currencies,
	formId,
	onRoomChange,
	onSubmit,
	ringGames,
	rooms,
	tournaments,
}: LiveSessionFormProps) {
	const { state, rulesOpen, setRulesOpen, rulesSummary, onFormSubmit } =
		useLiveSessionForm({ onRoomChange, onSubmit, ringGames, tournaments });

	return (
		<form className="flex flex-col gap-4" id={formId} onSubmit={onFormSubmit}>
			<MasterStepBody isLiveLinked={false} rooms={rooms} state={state} />
			<StartStepBody state={state} />
			<Accordion
				collapsible
				onValueChange={(value) => setRulesOpen(value === "rules")}
				type="single"
				value={rulesOpen ? "rules" : ""}
			>
				<AccordionItem className="border-t" value="rules">
					<AccordionTrigger>
						<span className="flex items-center gap-2">
							Customize rules
							{rulesSummary && (
								<span className="font-normal text-muted-foreground text-xs">
									{rulesSummary}
								</span>
							)}
						</span>
					</AccordionTrigger>
					<AccordionContent>
						<RulesStepBody
							currencies={currencies}
							isLiveLinked={false}
							state={state}
						/>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</form>
	);
}
