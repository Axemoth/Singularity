"use client";

import { api } from "@/trpc/react";
import { Button } from "@/app/_components/ui/button";
import { Badge } from "@/app/_components/ui/badge";
import { useState } from "react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const utils = api.useUtils();
  
  // Queries
  const { data: metrics, isLoading: isMetricsLoading } = api.admin.getMetrics.useQuery();
  const { data: users, isLoading: isUsersLoading, refetch: refetchUsers } = api.admin.listUsers.useQuery();
  
  // Mutation
  const updatePremium = api.admin.updateUserPremium.useMutation({
    onSuccess: async () => {
      await utils.admin.getMetrics.invalidate();
      await utils.admin.listUsers.invalidate();
      void refetchUsers();
    },
  });

  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const handleTogglePremium = async (userId: string, currentStatus: boolean) => {
    setUpdatingUserId(userId);
    try {
      await updatePremium.mutateAsync({
        userId,
        premiumOverride: !currentStatus,
      });
    } catch (err) {
      console.error("Failed to update premium override status:", err);
      alert("Error updating user premium status.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const isLoading = isMetricsLoading || isUsersLoading;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary px-6 py-10 flex flex-col items-center overflow-y-auto">
      <div className="w-full max-w-6xl flex flex-col gap-8 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-primary text-text-inverse font-bold text-sm shadow-sm">
                A
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">Admin Control Panel</h1>
            </div>
            <p className="mt-1.5 text-xs text-text-tertiary">
              Manage system metrics, trace AI Copilot limits, and manually override subscriber status.
            </p>
          </div>
          <Link href="/inbox">
            <Button variant="secondary" size="sm" className="font-semibold text-xs py-1.5 px-3">
              &larr; Back to App
            </Button>
          </Link>
        </div>

        {/* Metrics KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: "Total Registered Users",
              value: metrics?.totalUsers ?? 0,
              icon: "👥",
              desc: "Total signups in database",
            },
            {
              title: "Manual Premium Overrides",
              value: metrics?.premiumOverrides ?? 0,
              icon: "⭐",
              desc: "Users manually granted Premium",
            },
            {
              title: "Copilot Queries Today",
              value: metrics?.copilotUsageToday ?? 0,
              icon: "⚡",
              desc: "Daily requests across free tier",
            },
            {
              title: "Active OAuth Accounts",
              value: metrics?.activeConnections ?? 0,
              icon: "🔌",
              desc: "Gmail & Calendar connections",
            },
          ].map((card, i) => (
            <div key={i} className="glass rounded-2xl p-5 border border-border-default flex flex-col justify-between h-28 relative overflow-hidden">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{card.title}</span>
                <span className="text-lg">{card.icon}</span>
              </div>
              <div>
                <span className="text-2xl font-extrabold tracking-tight tabular-nums block text-text-primary leading-none">
                  {isMetricsLoading ? "…" : card.value}
                </span>
                <span className="text-[10px] text-text-tertiary mt-1 block">{card.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Users Table */}
        <div className="glass rounded-2xl border border-border-default overflow-hidden">
          <div className="border-b border-border-subtle p-5 bg-bg-raised/40 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Registered Users & Workspace Accounts</h2>
              <p className="text-[10px] text-text-tertiary mt-0.5">
                Detailed lists of connected Gmail and Calendar accounts per user and their daily AI usage.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
                <span className="text-xs text-text-tertiary font-medium">Loading user workspace details...</span>
              </div>
            ) : users && users.length > 0 ? (
              <table className="w-full border-collapse text-left text-xs text-text-secondary">
                <thead>
                  <tr className="border-b border-border-subtle bg-bg-raised/20 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                    <th className="px-5 py-3">User Details</th>
                    <th className="px-5 py-3">Gmail Connected</th>
                    <th className="px-5 py-3">Calendar Connected</th>
                    <th className="px-5 py-3 text-center">Copilot Requests (Today)</th>
                    <th className="px-5 py-3 text-right">Premium Bypass</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/40">
                  {users.map((u) => {
                    const isBypassed = u.premiumOverride === true;
                    const isUserAdmin = u.role === "admin";
                    const isWorking = updatingUserId === u.id;

                    return (
                      <tr key={u.id} className="hover:bg-bg-raised/15 transition-colors">
                        {/* User Details */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neutral-600 to-neutral-800 text-white font-bold text-xs shadow-inner uppercase">
                              {u.name?.[0] ?? "U"}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-text-primary truncate flex items-center gap-1.5">
                                {u.name}
                                {isUserAdmin && (
                                  <span className="px-1 py-0.2 bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-[8px] font-extrabold uppercase rounded-md tracking-wider">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-text-tertiary truncate mt-0.5">{u.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Connected Gmails */}
                        <td className="px-5 py-4 font-mono text-[10px] leading-relaxed">
                          {u.gmailAccounts.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {u.gmailAccounts.map((email, idx) => (
                                <span key={idx} className="truncate max-w-[200px] text-text-secondary font-medium">
                                  ✉️ {email}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-text-tertiary italic">None</span>
                          )}
                        </td>

                        {/* Connected Calendars */}
                        <td className="px-5 py-4 font-mono text-[10px] leading-relaxed">
                          {u.calendarAccounts.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {u.calendarAccounts.map((email, idx) => (
                                <span key={idx} className="truncate max-w-[200px] text-text-secondary font-medium">
                                  📅 {email}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-text-tertiary italic">None</span>
                          )}
                        </td>

                        {/* Copilot Requests Today */}
                        <td className="px-5 py-4 text-center">
                          {isBypassed ? (
                            <span className="px-2 py-0.5 bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-[9px] font-bold uppercase rounded-md tracking-wider">
                              Unlimited
                            </span>
                          ) : (
                            <div className="inline-flex flex-col items-center">
                              <span className="font-bold text-text-primary tracking-wide">
                                {u.copilotUsageToday} <span className="text-text-tertiary font-medium">/ 20</span>
                              </span>
                              <div className="w-16 h-1 bg-bg-inset border border-border-subtle rounded-full overflow-hidden mt-1.5">
                                <div
                                  className={`h-full ${u.copilotUsageToday >= 20 ? "bg-accent-danger" : "bg-accent-primary"}`}
                                  style={{ width: `${Math.min((u.copilotUsageToday / 20) * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Premium Status manual toggle */}
                        <td className="px-5 py-4 text-right">
                          <Button
                            variant={isBypassed ? "danger" : "primary"}
                            size="sm"
                            disabled={isWorking}
                            isLoading={isWorking}
                            onClick={() => handleTogglePremium(u.id, isBypassed)}
                            className="font-bold text-[10px] uppercase tracking-wider h-7 py-1 px-3 cursor-pointer"
                          >
                            {isBypassed ? "Revoke Premium" : "Grant Premium"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-text-tertiary">
                No registered users found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
