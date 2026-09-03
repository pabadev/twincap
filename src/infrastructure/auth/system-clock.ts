import type { Clock } from '../../core/application/ports';

/** Real wall-clock implementation of the Clock port. */
export const systemClock: Clock = {
  now: () => new Date(),
};
