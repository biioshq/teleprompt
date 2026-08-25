import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,

        /**
         * Retry the failures that are worth retrying and none of the others.
         *
         * A room that does not exist, or one on somebody else's account,
         * answers 4xx and will answer 4xx again however long we wait, so
         * retrying only delays an honest error message. A dropped connection
         * or a server error is exactly what a retry is for, and is what
         * happens when a laptop changes network mid-request.
         */
        retry: (failureCount, error) => {
          const status = (error as { data?: { httpStatus?: number } })?.data
            ?.httpStatus;
          if (typeof status === "number" && status >= 400 && status < 500) {
            return false;
          }
          return failureCount < 3;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
