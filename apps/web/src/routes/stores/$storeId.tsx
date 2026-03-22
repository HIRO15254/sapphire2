import { IconArrowLeft } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RingGameTab } from "@/components/stores/ring-game-tab";
import { TournamentTab } from "@/components/stores/tournament-tab";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/stores/$storeId")({
	component: StoreDetailPage,
});

function StoreDetailPage() {
	const { storeId } = Route.useParams();
	const storeQuery = useQuery(trpc.store.getById.queryOptions({ id: storeId }));

	const store = storeQuery.data;

	if (storeQuery.isLoading) {
		return (
			<div className="flex items-center justify-center p-16">
				<p className="text-muted-foreground">Loading...</p>
			</div>
		);
	}

	if (!store) {
		return (
			<div className="flex items-center justify-center p-16">
				<p className="text-muted-foreground">Store not found.</p>
			</div>
		);
	}

	return (
		<div className="p-4 md:p-6">
			<div className="mb-6 flex items-center gap-4">
				<Button asChild size="sm" variant="ghost">
					<Link to="/stores">
						<IconArrowLeft size={16} />
						Back
					</Link>
				</Button>
				<h1 className="font-bold text-2xl">{store.name}</h1>
			</div>

			{store.memo && (
				<p className="mb-6 text-muted-foreground text-sm">{store.memo}</p>
			)}

			<Tabs defaultValue="ring-games">
				<TabsList>
					<TabsTrigger value="ring-games">Cash Games</TabsTrigger>
					<TabsTrigger value="tournaments">Tournaments</TabsTrigger>
				</TabsList>
				<TabsContent value="ring-games">
					<RingGameTab storeId={storeId} />
				</TabsContent>
				<TabsContent value="tournaments">
					<TournamentTab storeId={storeId} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
