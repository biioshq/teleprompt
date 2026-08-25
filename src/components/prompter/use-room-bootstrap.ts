"use client";

import { useEffect, useRef } from "react";

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
  const query = api.room.byId.useQuery({ id: roomId }, { retry: false });
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
  };
}
