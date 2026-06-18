import { useQuery } from "@tanstack/react-query";
import type { PromotableSessionOption } from "@/features/sessions/utils/session-form-helpers";
import { trpc } from "@/utils/trpc";

/**
 * Promoted, unconsumed tournament sessions (live or manually recorded) that a
 * newly recorded next day can link back to.
 */
export function usePromotableSessions(): PromotableSessionOption[] {
	const query = useQuery(
		trpc.liveTournamentSession.listPromotable.queryOptions()
	);
	return (query.data ?? []).map((s) => ({
		id: s.id,
		ruleName: s.ruleName,
		bagStack: s.bagStack,
	}));
}
