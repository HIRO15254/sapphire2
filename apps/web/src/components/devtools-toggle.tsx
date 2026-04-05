import { IconBug } from "@tabler/icons-react";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type DevtoolsTab = "router" | "query" | null;

export function DevtoolsToggle() {
	const [activeTab, setActiveTab] = useState<DevtoolsTab>(null);

	const toggle = (tab: DevtoolsTab) => {
		setActiveTab((prev) => (prev === tab ? null : tab));
	};

	return (
		<>
			<div className="fixed top-2 right-2 z-50 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 hover:opacity-100">
				<Button
					className={`text-xs ${
						activeTab === "router"
							? "bg-primary text-primary-foreground"
							: "bg-muted/80 text-muted-foreground hover:bg-muted"
					}`}
					onClick={() => toggle("router")}
					size="icon-xs"
					title="Router Devtools"
					type="button"
					variant="ghost"
				>
					<IconBug size={14} />
				</Button>
				<Button
					className={`text-xs ${
						activeTab === "query"
							? "bg-primary text-primary-foreground"
							: "bg-muted/80 text-muted-foreground hover:bg-muted"
					}`}
					onClick={() => toggle("query")}
					size="icon-xs"
					title="Query Devtools"
					type="button"
					variant="ghost"
				>
					<IconBug className="rotate-45" size={14} />
				</Button>
			</div>
			{activeTab === "router" && (
				<div className="fixed inset-x-0 top-8 z-50 mx-auto max-w-[90vw]">
					<TanStackRouterDevtoolsPanel
						style={{ height: "40vh", overflow: "auto" }}
					/>
				</div>
			)}
			{activeTab === "query" && (
				<div className="fixed inset-x-0 top-8 z-50 mx-auto max-w-[90vw]">
					<ReactQueryDevtoolsPanel
						style={{ height: "40vh", overflow: "auto" }}
					/>
				</div>
			)}
		</>
	);
}
