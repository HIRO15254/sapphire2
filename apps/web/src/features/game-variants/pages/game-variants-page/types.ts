/**
 * Row shape actually returned by `useGameVariants().variants` at runtime.
 *
 * The hook's own `GameVariant` export declares `archivedAt: Date | null`,
 * but no `superjson` transformer is configured for this tRPC setup (see
 * `apps/web/src/utils/trpc.ts`), so Date columns are serialized as ISO
 * strings over the wire — the same convention `RingGame` and `Tournament`
 * already use (`archivedAt: string | null`). Since the hook never actually
 * casts `variants` to its hand-written `GameVariant` interface, the type
 * inferred by callers is the correct (string-based) one; this local alias
 * names that real shape so this feature's components stay type-correct
 * against what actually flows at runtime.
 */
export interface GameVariantRow {
	archivedAt: string | null;
	blindLabel1: string | null;
	blindLabel2: string | null;
	blindLabel3: string | null;
	id: string;
	name: string;
	sortOrder: number;
}
