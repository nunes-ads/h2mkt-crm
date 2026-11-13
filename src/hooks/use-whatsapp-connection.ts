import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getEvolutionStatus, type EvolutionStatusResponse } from "@/lib/evolution.functions";
import { WHATSAPP_POLL_INTERVAL, type WhatsAppAccountId } from "@/lib/whatsapp-connection";

export function useWhatsAppConnection(accountId: WhatsAppAccountId) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const client = useQueryClient();
  const getStatus = useServerFn(getEvolutionStatus);
  const userId = user!.id;
  const query = useQuery({
    queryKey: ["whatsapp-connection", userId, accountId],
    queryFn: () => getStatus({ data: { accountId } }),
    refetchInterval: WHATSAPP_POLL_INTERVAL,
    refetchOnMount: "always",
    retry: false,
  });
  const markDisconnected = useCallback(
    async (instance: string) => {
      const key = ["whatsapp-connection", userId, accountId];
      await client.cancelQueries({ queryKey: key, exact: true });
      client.setQueryData<EvolutionStatusResponse>(key, {
        configured: true,
        state: "close",
        instance,
        phone: null,
        profilePicUrl: null,
        count: 0,
        chatsCount: 0,
        contactsCount: 0,
      });
    },
    [client, userId, accountId],
  );
  return {
    status: query.isFetchedAfterMount && !query.error ? query.data : undefined,
    error: query.error,
    refresh: query.refetch,
    checking: query.isFetching,
    markDisconnected,
  };
}
