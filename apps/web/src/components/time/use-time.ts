import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

/** The current time, refreshed every second while `active`. */
export function useNow(active = true): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) {
			return;
		}
		setNow(Date.now());
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, [active]);
	return now;
}

export function useRunningEntry() {
	return useQuery({ ...trpc.time.current.queryOptions(), staleTime: 30_000 });
}

export function useInvalidateTime() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: trpc.time.pathKey() });
}

export function useStartTimer() {
	const invalidate = useInvalidateTime();
	return useMutation(
		trpc.time.start.mutationOptions({
			onError: () => toast.error("計測を始められませんでした"),
			onSettled: invalidate,
		})
	);
}

export function useStopTimer() {
	const invalidate = useInvalidateTime();
	return useMutation(
		trpc.time.stop.mutationOptions({
			onError: () => toast.error("計測を止められませんでした"),
			onSettled: invalidate,
		})
	);
}
