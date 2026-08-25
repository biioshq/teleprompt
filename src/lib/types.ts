/**
 * `Omit` collapses a discriminated union into one object type, which loses the
 * discriminant. This distributes over the union first, so each member keeps its
 * own shape.
 */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;
