import { useQuery } from "@tanstack/react-query";
import { checkForUpdates, VersionResponse } from "@/lib/version";

export function useVersionCheck(enabled: boolean = true) {
  return useQuery<VersionResponse | null>({
    queryKey: ["version-check"],
    queryFn: checkForUpdates,
    enabled,
    staleTime: 1000 * 60 * 60, // 1 hour
    refetchInterval: 1000 * 60 * 60 * 6, // Check every 6 hours
    retry: 1,
  });
}
