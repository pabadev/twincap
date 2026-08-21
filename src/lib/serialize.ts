/**
 * Contract implemented by domain entities for the Next.js server→client
 * serialization boundary. toJSON() resolves prototype getters (pending,
 * abonos, ...) into own properties, which structuredClone would strip.
 */
export interface SerializableEntity<T> {
  toJSON(): T;
}

/** Serialize a single entity via its toJSON() snapshot. */
export function serializeEntity<T>(entity: SerializableEntity<T>): T {
  return entity.toJSON();
}

/** Serialize a collection of entities via their toJSON() snapshots. */
export function serializeEntities<T>(
  entities: ReadonlyArray<SerializableEntity<T>>,
): T[] {
  return entities.map((entity) => entity.toJSON());
}
