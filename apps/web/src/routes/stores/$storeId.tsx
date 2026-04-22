import { IconArrowLeft } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/components/ui/tabs";
import { RingGameTab } from "@/stores/components/ring-game-tab";
import { TournamentTab } from "@/stores/components/tournament-tab";
import { useStoreDetailPage } from "@/stores/hooks/use-store-detail-page";

export const Route = createFileRoute("/stores/$storeId")({
	component: StoreDetailPage,
});

function StoreDetailPage() {
	const { storeId } = Route.useParams();
	const { store, isLoading, expandedGameId, handleToggleGame } =
		useStoreDetailPage(storeId);

	if (isLoading) {
		return (
			<div className="p-4 md:p-6">
				<div className="flex items-center justify-center py-16">
					<p className="text-muted-foreground text-sm">Loading store...</p>
				</div>
			</div>
		);
	}

	if (!store) {
		return (
			<div className="p-4 md:p-6">
				<div className="flex items-center justify-center py-16">
					<p className="text-muted-foreground text-sm">Store not found.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="p-4 md:p-6">
			<PageHeader
				actions={
					<Button asChild size="sm" variant="ghost">
						<Link to="/stores">
							<IconArrowLeft size={16} />
							Back
						</Link>
					</Button>
				}
				description={store.memo ?? undefined}
				heading={store.name}
			/>

			<Tabs defaultValue="ring-games">
				<TabsList>
					<TabsTrigger value="ring-games">Cash Games</TabsTrigger>
					<TabsTrigger value="tournaments">Tournaments</TabsTrigger>
				</TabsList>
				<TabsContent value="ring-games">
					<RingGameTab
						expandedGameId={expandedGameId}
						onToggleGame={handleToggleGame}
						storeId={storeId}
					/>
				</TabsContent>
				<TabsContent value="tournaments">
					<TournamentTab
						expandedGameId={expandedGameId}
						onToggleGame={handleToggleGame}
						storeId={storeId}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}
