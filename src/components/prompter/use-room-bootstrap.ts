"use client";

import { useEffect, useRef, useState } from "react";

import { getDevice } from "~/lib/device";
import { type Role } from "~/lib/realtime/protocol";
import { api } from "~/trpc/react";

/**
 * Loads the room and registers this browser as one of its devices.
 *
 * `byId` is the only endpoint that returns the room's channel key, and it is
 * scoped to the owning account — so a device that is not signed in as the same
 * person simply cannot obtain the secret that names the realtime channel.
 */
export function useRoomBootstrap(roomId: string, role: Role) {
  // No `retry: false` here. A room that is genuinely missing answers 4xx and
  // the shared policy gives up on it immediately; a request that died because
  // the network changed deserves another go.
  const query = api.room.byId.useQuery({ id: roomId });

  /**
   * Loading has gone on long enough that a person deserves to be told, and
   * offered a way out. Retries and the request deadline should get there
   * first, but "should" is not a plan when someone is about to go on camera.
   */
  const [slow, setSlow] = useState(false);
  const settled = Boolean(query.data) || Boolean(query.error);
  useEffect(() => {
    if (settled) {
      setSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, [settled]);
  const join = api.room.join.useMutation();
  const joinRef = useRef(join.mutate);
  joinRef.current = join.mutate;
  const announced = useRef<string | null>(null);

  useEffect(() => {
    if (!query.data) return;
    const key = `${roomId}:${role}`;
    if (announced.current === key) return;
    announced.current = key;

    const device = getDevice();
    joinRef.current({
      roomId,
      device: {
        deviceKey: device.deviceKey,
        label: device.label,
        platform: device.platform,
        role,
      },
    });
  }, [query.data, roomId, role]);

  return {
    room: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    /** Still waiting after eight seconds. */
    slow: slow && !settled,
  };
}
