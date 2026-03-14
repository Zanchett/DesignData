"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  TrendingUp,
  Settings,
  BarChart3,
  Sheet,
  FileText,
  LogOut,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const navigation = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Designers", href: "/dashboard/designers", icon: Users },
  { name: "Clients", href: "/dashboard/clients", icon: Briefcase },
  { name: "Hour Tracker", href: "/dashboard/hour-tracker", icon: Sheet },
  { name: "Reports", href: "/dashboard/reports", icon: FileText },
  { name: "Time Analysis", href: "/dashboard/time-analysis", icon: TrendingUp },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-sidebar-background">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/25">
          <BarChart3 className="h-4.5 w-4.5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-foreground">Design Force</h1>
          <p className="text-[10px] font-medium text-primary/70">Analytics</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.name}
            </Link>
          );
        })}

        {/* Admin-only: User Management */}
        {isAdmin && (
          <Link
            href="/dashboard/settings/users"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              pathname === "/dashboard/settings/users"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            )}
          >
            <Shield className="h-4 w-4 shrink-0" />
            User Management
          </Link>
        )}
      </nav>

      {/* User Footer */}
      <div className="border-t border-border px-4 py-3">
        {user ? (
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {user.email}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {isAdmin ? "Admin" : "Member"}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            Powered by ClickUp API
          </p>
        )}
      </div>
    </aside>
  );
}
