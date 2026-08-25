"use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { httpBatchStreamLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import SuperJSON from "superjson";

import { type AppRouter } from "~/server/api/root";
import { createQueryClient } from "./query-client";

/**
 * Every request gets a deadline.
 *
 * Without one, a network that changes underneath an in-flight request leaves
 * the fetch hanging on a socket the browser has not yet noticed is dead. The
 * promise never settles, so the query never leaves its pending state, and the
 * app sits on "Opening the room" with nothing scheduled to rescue it. Failing
 * is recoverable; hanging is not.
 *
 * `AbortSignal.timeout` is used rather than a cleared `setTimeout` on purpose:
 * these are streamed responses, so `fetch` resolves when the headers arrive
 * and the body can still stall afterwards. The timeout has to outlive that.
 */
const REQUEST_TIMEOUT_MS = 20_000;

const fetchWithDeadline: typeof fetch = (input, init) => {
  const deadline =
    typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      : undefined;

  const signal =
    deadline && init?.signal && typeof AbortSignal.any === "function"
      ? // Whichever fires first: our deadline, or React Query cancelling.
        AbortSignal.any([init.signal, deadline])
      : (deadline ?? init?.signal ?? undefined);

  return fetch(input, { ...init, signal });
};

let clientQueryClientSingleton: QueryClient | undefined = undefined;
const getQueryClient = () => {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return createQueryClient();
  }
  // Browser: use singleton pattern to keep the same query client
  clientQueryClientSingleton ??= createQueryClient();

  return clientQueryClientSingleton;
};

export const api = createTRPCReact<AppRouter>();

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: getBaseUrl() + "/api/trpc",
          fetch: fetchWithDeadline,
          headers: () => {
            const headers = new Headers();
            headers.set("x-trpc-source", "nextjs-react");
            return headers;
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
