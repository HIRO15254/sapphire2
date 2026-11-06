import { Spinner } from "@/shared/components/ui/spinner";

export default function Loader() {
	return (
		<div className="text-muted-foreground flex h-full items-center justify-center pt-8">
			<Spinner />
		</div>
	);
}
