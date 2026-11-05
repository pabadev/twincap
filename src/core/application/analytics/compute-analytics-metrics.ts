import type {
  AnalyticsAction,
  AnalyticsEventName,
  AnalyticsFeature,
  AnalyticsMetricScope,
} from "../ports";

export interface AnalyticsMetricEvent {
  eventName: AnalyticsEventName;
  workspaceId: string;
  occurredAt: Date;
  feature?: AnalyticsFeature;
  action?: AnalyticsAction;
  metricScope?: AnalyticsMetricScope;
  context?: "Personal" | "Business";
}

/** Legacy events remain readable while new events carry explicit metric scopes. */
const LEGACY_RETENTION_EVENT_NAMES: ReadonlySet<AnalyticsEventName> = new Set([
  "movementCreated",
  "saleCreated",
  "transferCreated",
  "creditReceivedCreated",
  "creditGrantedCreated",
  "payableCreated",
]);

const LEGACY_ACTIVATION_EVENT_NAMES: ReadonlySet<AnalyticsEventName> = new Set([
  "movementCreated",
  "saleCreated",
  "transferCreated",
  "creditReceivedCreated",
  "creditGrantedCreated",
  "payableCreated",
]);

const LEGACY_FEATURE_BY_EVENT: Partial<Record<AnalyticsEventName, AnalyticsFeature>> = {
  accountCreated: "accounts",
  movementCreated: "movements",
  saleCreated: "sales",
  transferCreated: "transfers",
  creditReceivedCreated: "creditReceived",
  creditGrantedCreated: "creditGranted",
  payableCreated: "payables",
};

function countsForRetention(event: AnalyticsMetricEvent): boolean {
  if (event.metricScope) {
    return event.metricScope === "activation" || event.metricScope === "retention";
  }
  return LEGACY_RETENTION_EVENT_NAMES.has(event.eventName);
}

function countsForActivation(event: AnalyticsMetricEvent): boolean {
  if (event.metricScope) return event.metricScope === "activation";
  return LEGACY_ACTIVATION_EVENT_NAMES.has(event.eventName);
}

export interface AnalyticsMetricSnapshot {
  totalRegistered: number;
  activationEligibleWorkspaces: number;
  activatedWorkspaces: number;
  activationRate: number | null;
  retention7dEligibleWorkspaces: number;
  returned7dWorkspaces: number;
  retention7d: number | null;
  retention30dEligibleWorkspaces: number;
  returned30dWorkspaces: number;
  retention30d: number | null;
  activeWorkspaces7d: number;
  activeWorkspaces30d: number;
  activePersonalWorkspaces30d: number;
  activeBusinessWorkspaces30d: number;
  featureUsage30d: Array<{ feature: AnalyticsFeature; events: number; workspaces: number }>;
  totalMovementsCreated: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.round((numerator / denominator) * 100);
}

/**
 * Computes decision-facing metrics from append-only events.
 * Activation counts three tracked value actions in the first 48 hours. Retention
 * cohorts count tracked value actions only; registration, login, account setup,
 * and passive dashboard views are deliberately excluded.
 */
export function computeAnalyticsMetrics(
  events: readonly AnalyticsMetricEvent[],
  now: Date,
): AnalyticsMetricSnapshot {
  const registrations = new Map<string, Date>();
  for (const event of events) {
    if (event.eventName !== "register") continue;
    const current = registrations.get(event.workspaceId);
    if (!current || event.occurredAt < current) {
      registrations.set(event.workspaceId, event.occurredAt);
    }
  }

  const activityByWorkspace = new Map<string, AnalyticsMetricEvent[]>();
  for (const event of events) {
    if (!countsForRetention(event)) continue;
    const workspaceEvents = activityByWorkspace.get(event.workspaceId) ?? [];
    workspaceEvents.push(event);
    activityByWorkspace.set(event.workspaceId, workspaceEvents);
  }

  let activationEligibleWorkspaces = 0;
  let activatedWorkspaces = 0;
  let retention7dEligibleWorkspaces = 0;
  let returned7dWorkspaces = 0;
  let retention30dEligibleWorkspaces = 0;
  let returned30dWorkspaces = 0;
  let totalMovementsCreated = 0;

  for (const [workspaceId, registeredAt] of registrations) {
    const workspaceEvents = activityByWorkspace.get(workspaceId) ?? [];
    const activationEnd = registeredAt.getTime() + 2 * DAY_MS;
    const activationMature = activationEnd <= now.getTime();
    const actionsInActivationWindow = workspaceEvents.filter(
      (event) =>
        countsForActivation(event) &&
        event.occurredAt >= registeredAt &&
        event.occurredAt.getTime() < activationEnd,
    ).length;

    if (activationMature) {
      activationEligibleWorkspaces++;
      if (actionsInActivationWindow >= 3) activatedWorkspaces++;
    }

    const retention7dStart = registeredAt.getTime() + 7 * DAY_MS;
    const retention7dEnd = registeredAt.getTime() + 14 * DAY_MS;
    if (retention7dEnd <= now.getTime()) {
      retention7dEligibleWorkspaces++;
      if (
        workspaceEvents.some(
          (event) =>
            event.occurredAt.getTime() >= retention7dStart &&
            event.occurredAt.getTime() < retention7dEnd,
        )
      ) {
        returned7dWorkspaces++;
      }
    }

    const retention30dStart = registeredAt.getTime() + 30 * DAY_MS;
    const retention30dEnd = registeredAt.getTime() + 37 * DAY_MS;
    if (retention30dEnd <= now.getTime()) {
      retention30dEligibleWorkspaces++;
      if (
        workspaceEvents.some(
          (event) =>
            event.occurredAt.getTime() >= retention30dStart &&
            event.occurredAt.getTime() < retention30dEnd,
        )
      ) {
        returned30dWorkspaces++;
      }
    }

    totalMovementsCreated += workspaceEvents.filter(
      (event) => event.eventName === "movementCreated",
    ).length;
  }

  const sevenDaysAgo = now.getTime() - 7 * DAY_MS;
  const thirtyDaysAgo = now.getTime() - 30 * DAY_MS;
  const activeWorkspaces7d = new Set<string>();
  const activeWorkspaces30d = new Set<string>();
  const activePersonalWorkspaces30d = new Set<string>();
  const activeBusinessWorkspaces30d = new Set<string>();
  const featureUsage = new Map<AnalyticsFeature, { events: number; workspaces: Set<string> }>();
  for (const event of events) {
    const occurredAt = event.occurredAt.getTime();
    const feature = event.feature ?? LEGACY_FEATURE_BY_EVENT[event.eventName];
    if (feature && occurredAt <= now.getTime() && occurredAt >= thirtyDaysAgo) {
      const usage = featureUsage.get(feature) ?? { events: 0, workspaces: new Set<string>() };
      usage.events++;
      usage.workspaces.add(event.workspaceId);
      featureUsage.set(feature, usage);
    }
    if (!countsForRetention(event)) continue;
    if (occurredAt <= now.getTime() && occurredAt >= thirtyDaysAgo) {
      activeWorkspaces30d.add(event.workspaceId);
      if (event.context === "Personal") activePersonalWorkspaces30d.add(event.workspaceId);
      if (event.context === "Business") activeBusinessWorkspaces30d.add(event.workspaceId);
      if (occurredAt >= sevenDaysAgo) activeWorkspaces7d.add(event.workspaceId);
    }
  }

  return {
    totalRegistered: registrations.size,
    activationEligibleWorkspaces,
    activatedWorkspaces,
    activationRate: rate(activatedWorkspaces, activationEligibleWorkspaces),
    retention7dEligibleWorkspaces,
    returned7dWorkspaces,
    retention7d: rate(returned7dWorkspaces, retention7dEligibleWorkspaces),
    retention30dEligibleWorkspaces,
    returned30dWorkspaces,
    retention30d: rate(returned30dWorkspaces, retention30dEligibleWorkspaces),
    activeWorkspaces7d: activeWorkspaces7d.size,
    activeWorkspaces30d: activeWorkspaces30d.size,
    activePersonalWorkspaces30d: activePersonalWorkspaces30d.size,
    activeBusinessWorkspaces30d: activeBusinessWorkspaces30d.size,
    featureUsage30d: [...featureUsage.entries()]
      .map(([feature, usage]) => ({
        feature,
        events: usage.events,
        workspaces: usage.workspaces.size,
      }))
      .sort((a, b) => a.feature.localeCompare(b.feature)),
    totalMovementsCreated,
  };
}
