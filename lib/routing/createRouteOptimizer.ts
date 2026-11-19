import { assertRoutingEngineServer, routingEngineEnvPresent } from '@/lib/routing/engineConfig';
import { EngineRouteOptimizer } from '@/lib/routing/engineOptimizer';
import { createHaversineRouteOptimizer } from '@/lib/routing/haversineOptimizer';
import type { RouteOptimizer } from '@/lib/routing/types';

/**
 * Straight-line order when the engine is unset.
 * A configured engine still falls back per request when the call cannot be used.
 */
export function createRouteOptimizer(): RouteOptimizer {
  assertRoutingEngineServer();
  if (!routingEngineEnvPresent(process.env)) return createHaversineRouteOptimizer();
  return new EngineRouteOptimizer();
}
