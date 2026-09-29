import { cn } from "@/lib/utils";
import { CRYST_FIELD } from "../../cryst-controls";
import type { SessionForm } from "./use-session-sheet";

const HINT_ID = "cryst-session-house-rules-hint";

export function SessionNotesTab({ form }: { form: SessionForm }) {
	return (
		<div className="flex flex-col gap-2">
			<form.Field name="houseRules">
				{(field) => (
					<textarea
						aria-describedby={HINT_ID}
						aria-label="House rules"
						className={cn(
							CRYST_FIELD,
							"box-border max-h-60 min-h-45 w-full resize-none rounded-lg p-3 text-[length:var(--m-text-secondary)] leading-relaxed"
						)}
						onBlur={field.handleBlur}
						onChange={(e) => field.handleChange(e.target.value)}
						rows={7}
						value={field.state.value}
					/>
				)}
			</form.Field>
			<p
				className="text-[length:var(--text-xs)] text-muted-foreground"
				id={HINT_ID}
			>
				House rules, straddle handling, tipping — anything the table agreed on.
				Saved with this session's rule snapshot.
			</p>
		</div>
	);
}
