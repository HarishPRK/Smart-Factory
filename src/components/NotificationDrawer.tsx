import React, { useState, useEffect, useRef, useMemo } from "react";
import type { Alert, Severity } from "../types";
import { useSiteWiseAlarms } from "../hooks/useSiteWiseAlarms";

/* ── Types ───────────────────────────────────────────── */

export interface Notification {
  id: string;
  title: string;
  message: string;
  severity: Severity;
  time: string;
  group: "alerts" | "updates" | "system";
  read: boolean;
}

type FilterTab = "all" | "alerts" | "updates" | "system";

/* ── Helpers ─────────────────────────────────────────── */

function alertsToNotifications(alerts: Alert[]): Notification[] {
  return alerts.map((a) => ({
    id: a.id,
    title: a.machineName,
    message: a.issue,
    severity: a.severity,
    time: a.time,
    group: "alerts",
    read: false,
  }));
}

const SYSTEM_NOTIFICATIONS: Notification[] = [
  {
    id: "sys-1",
    title: "SiteWise Ingestion",
    message: "Data pipeline connected and streaming",
    severity: "info",
    time: "2h ago",
    group: "system",
    read: true,
  },
  {
    id: "sys-2",
    title: "Shift Change",
    message: "Shift B operators now active across all zones",
    severity: "info",
    time: "3h ago",
    group: "system",
    read: true,
  },
];

const UPDATE_NOTIFICATIONS: Notification[] = [
  {
    id: "upd-1",
    title: "CNC Lathe Firmware",
    message: "Firmware v2.4.1 update available for Zone 2 CNC units",
    severity: "info",
    time: "1h ago",
    group: "updates",
    read: false,
  },
  {
    id: "upd-2",
    title: "Maintenance Scheduled",
    message: "Hydraulic Press Unit — planned downtime tomorrow 06:00–08:00",
    severity: "warning",
    time: "30m ago",
    group: "updates",
    read: false,
  },
];

/* ── Severity styles ─────────────────────────────────── */

const severityConfig: Record<
  Severity,
  {
    dot: string;
    bg: string;
    border: string;
    text: string;
    icon: string;
    glow: string;
  }
> = {
  critical: {
    dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]",
    bg: "from-red-950/30 to-red-950/10",
    border: "border-red-500/15 hover:border-red-500/30",
    text: "text-red-200/90",
    icon: "bg-red-500/10 border-red-500/15",
    glow: "bg-red-500/[0.06]",
  },
  warning: {
    dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]",
    bg: "from-amber-950/30 to-amber-950/10",
    border: "border-amber-500/15 hover:border-amber-500/30",
    text: "text-amber-200/90",
    icon: "bg-amber-500/10 border-amber-500/15",
    glow: "bg-amber-500/[0.06]",
  },
  info: {
    dot: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.7)]",
    bg: "from-blue-950/30 to-blue-950/10",
    border: "border-blue-500/15 hover:border-blue-500/30",
    text: "text-blue-200/90",
    icon: "bg-blue-500/10 border-blue-500/15",
    glow: "bg-blue-500/[0.06]",
  },
};

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "alerts", label: "Alerts" },
  { id: "updates", label: "Updates" },
  { id: "system", label: "System" },
];

/* ── Severity icon ───────────────────────────────────── */

function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === "critical")
    return (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 2L1 18h18L10 2z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          className="text-red-400"
        />
        <path
          d="M10 8v4M10 14.5v.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-red-400"
        />
      </svg>
    );
  if (severity === "warning")
    return (
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" className="text-amber-400" />
        <path
          d="M10 6v5M10 13.5v.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-amber-400"
        />
      </svg>
    );
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" className="text-blue-400" />
      <path
        d="M10 9v5M10 6.5v.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="text-blue-400"
      />
    </svg>
  );
}

/* ── Component ───────────────────────────────────────── */

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
  alerts: Alert[];
}

const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  open,
  onClose,
  alerts,
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const drawerRef = useRef<HTMLDivElement>(null);
  const { alarms, configured: alarmsConfigured } = useSiteWiseAlarms(10_000);

  // Build full notification list from alerts + SiteWise alarms + static data
  const allNotifications = useMemo<Notification[]>(() => {
    const fromAlerts = alertsToNotifications(alerts);

    // Convert SiteWise alarms to notifications
    const fromAlarms: Notification[] = alarmsConfigured
      ? alarms
          .filter((a) => a.state === "ACTIVE")
          .map((a) => ({
            id: `sw-alarm-${a.alarmId}`,
            title: `${a.label} Alarm`,
            message: `${a.property} is ${a.currentValue?.toFixed(1) ?? "?"} (threshold: ${a.threshold.operator} ${a.threshold.value})`,
            severity: a.severity === 1 ? "critical" as Severity : "warning" as Severity,
            time: a.timestamp ? `${Math.round((Date.now() - a.timestamp) / 60000)}m ago` : "now",
            group: "alerts" as const,
            read: false,
          }))
      : [];

    return [...fromAlarms, ...fromAlerts, ...UPDATE_NOTIFICATIONS, ...SYSTEM_NOTIFICATIONS];
  }, [alerts, alarms, alarmsConfigured]);

  // Apply read state
  const notifications = useMemo(
    () =>
      allNotifications.map((n) => ({
        ...n,
        read: n.read || readIds.has(n.id),
      })),
    [allNotifications, readIds]
  );

  // Filter by active tab
  const filtered = useMemo(
    () =>
      activeTab === "all"
        ? notifications
        : notifications.filter((n) => n.group === activeTab),
    [notifications, activeTab]
  );

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    for (const n of filtered) {
      const key = n.group;
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    }
    return groups;
  }, [filtered]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: 0,
      alerts: 0,
      updates: 0,
      system: 0,
    };
    for (const n of notifications) {
      if (!n.read) {
        counts.all++;
        counts[n.group]++;
      }
    }
    return counts;
  }, [notifications]);

  // Mark single notification as read
  const markRead = (id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
  };

  // Mark all as read
  const markAllRead = () => {
    setReadIds(new Set(allNotifications.map((n) => n.id)));
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        drawerRef.current &&
        !drawerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    // Delay to avoid the click that opened the drawer from immediately closing it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const groupLabels: Record<string, string> = {
    alerts: "Alerts",
    updates: "Updates",
    system: "System",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 z-50 h-full w-[400px] max-w-[90vw] flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Glass background */}
        <div className="absolute inset-0 bg-[#060e1f]/95 backdrop-blur-2xl border-l border-cyan-300/10" />

        {/* Content */}
        <div className="relative flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h2 className="text-[15px] font-semibold text-cyan-50 tracking-tight">
                Notifications
              </h2>
              <p className="text-[10px] text-sky-200/50 font-medium mt-0.5">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                  : "All caught up"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] text-cyan-300/60 hover:text-cyan-200 font-medium px-2.5 py-1.5 rounded-lg hover:bg-cyan-500/[0.06] transition-all duration-200"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/[0.06] text-cyan-100/40 hover:text-white transition-all duration-200"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-5 pb-3">
            <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-cyan-300/[0.06]">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 text-[10px] font-semibold py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    activeTab === tab.id
                      ? "bg-cyan-500/[0.12] text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.06)]"
                      : "text-sky-200/40 hover:text-sky-100/60 hover:bg-white/[0.03]"
                  }`}
                >
                  {tab.label}
                  {tabCounts[tab.id] > 0 && (
                    <span
                      className={`min-w-[16px] h-4 text-[8px] font-bold flex items-center justify-center px-1 rounded-full ${
                        activeTab === tab.id
                          ? "bg-cyan-400/20 text-cyan-200"
                          : "bg-white/[0.06] text-sky-200/50"
                      }`}
                    >
                      {tabCounts[tab.id]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="mx-5 h-px bg-gradient-to-r from-transparent via-cyan-300/10 to-transparent" />

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 scrollbar-thin">
            {filtered.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/[0.06] border border-cyan-300/[0.08] flex items-center justify-center mb-4">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-cyan-300/30"
                  >
                    <path
                      d="M12 2a8 8 0 00-8 8v4l-2 3h20l-2-3v-4a8 8 0 00-8-8z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9 21a3 3 0 006 0"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <p className="text-[13px] font-medium text-cyan-100/70">
                  No notifications
                </p>
                <p className="text-[11px] text-sky-200/35 mt-1.5 leading-relaxed">
                  {activeTab === "all"
                    ? "You're all caught up. We'll notify you when something needs attention."
                    : `No ${activeTab} notifications right now.`}
                </p>
              </div>
            ) : (
              Object.entries(grouped).map(([group, items]) => (
                <div key={group}>
                  {/* Group header (only show when on "all" tab) */}
                  {activeTab === "all" && (
                    <div className="flex items-center gap-2 px-2 mb-2">
                      <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-200/40">
                        {groupLabels[group] ?? group}
                      </span>
                      <div className="flex-1 h-px bg-gradient-to-r from-cyan-300/[0.06] to-transparent" />
                      <span className="text-[9px] text-sky-200/25 font-medium">
                        {items.filter((n) => !n.read).length} new
                      </span>
                    </div>
                  )}

                  {/* Items */}
                  <div className="space-y-1.5">
                    {items.map((n) => {
                      const style = severityConfig[n.severity];
                      return (
                        <button
                          key={n.id}
                          onClick={() => markRead(n.id)}
                          className={`w-full text-left px-3 py-3 rounded-xl border transition-all duration-200 group/item relative overflow-hidden ${
                            n.read
                              ? "bg-transparent border-white/[0.03] hover:border-white/[0.06] opacity-55"
                              : `bg-gradient-to-br ${style.bg} ${style.border}`
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0 mt-0.5 ${
                                n.read
                                  ? "bg-white/[0.03] border-white/[0.05]"
                                  : style.icon
                              }`}
                            >
                              <SeverityIcon severity={n.severity} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[11px] font-medium truncate ${
                                    n.read
                                      ? "text-cyan-100/60"
                                      : style.text
                                  }`}
                                >
                                  {n.title}
                                </span>
                                {!n.read && (
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse-glow ${style.dot}`}
                                  />
                                )}
                              </div>
                              <p
                                className={`text-[10px] mt-0.5 leading-relaxed ${
                                  n.read
                                    ? "text-sky-200/30"
                                    : "text-sky-200/50"
                                }`}
                              >
                                {n.message}
                              </p>
                              <span className="text-[9px] text-sky-300/25 mt-1 block font-medium">
                                {n.time}
                              </span>
                            </div>
                          </div>

                          {/* Subtle glow for unread */}
                          {!n.read && (
                            <div
                              className={`absolute -bottom-4 -left-4 w-16 h-16 blur-[20px] rounded-full pointer-events-none ${style.glow}`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-cyan-300/[0.06]">
            <button className="w-full text-[10px] font-semibold text-cyan-300/50 hover:text-cyan-200 py-2 rounded-lg hover:bg-cyan-500/[0.04] transition-all duration-200 uppercase tracking-[0.15em]">
              View all activity
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotificationDrawer;
