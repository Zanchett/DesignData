"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import {
  Shield,
  UserPlus,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
} from "lucide-react";

interface AppUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
}

export default function UserManagementPage() {
  const { user: currentUser, isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin, fetchUsers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInviting(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to invite user");
      } else {
        setSuccessMsg(`Invitation sent to ${inviteEmail}`);
        setInviteEmail("");
        setShowInvite(false);
        setTimeout(() => setSuccessMsg(""), 3000);
        fetchUsers();
      }
    } catch {
      setError("Failed to invite user");
    } finally {
      setInviting(false);
    }
  };

  const handleDelete = async (userId: string) => {
    setError("");
    setDeleting(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to remove user");
      } else {
        setSuccessMsg("User removed successfully");
        setTimeout(() => setSuccessMsg(""), 3000);
        fetchUsers();
      }
    } catch {
      setError("Failed to remove user");
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="mb-4 h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground">
          You need admin privileges to manage users.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">User Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage who can access the dashboard
          </p>
        </div>
        <Button
          onClick={() => setShowInvite(!showInvite)}
          className="h-9"
          size="sm"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg bg-green-500/10 px-4 py-2.5 text-sm text-green-500">
          {successMsg}
        </div>
      )}

      {/* Invite Form */}
      {showInvite && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleInvite} className="flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Email Address
                </label>
                <Input
                  type="email"
                  placeholder="newuser@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  autoFocus
                  className="h-9"
                />
              </div>
              <Button type="submit" className="h-9" disabled={inviting}>
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invite
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 w-9 p-0"
                onClick={() => setShowInvite(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </form>
            <p className="mt-2 text-[11px] text-muted-foreground">
              They&apos;ll receive an email with a link to set their password.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Shield className="h-4 w-4" />
            Team Members ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2.5 pr-4 font-medium text-muted-foreground">
                    Email
                  </th>
                  <th className="pb-2.5 pr-4 font-medium text-muted-foreground">
                    Role
                  </th>
                  <th className="pb-2.5 pr-4 font-medium text-muted-foreground">
                    Joined
                  </th>
                  <th className="pb-2.5 pr-4 font-medium text-muted-foreground">
                    Last Sign In
                  </th>
                  <th className="pb-2.5 font-medium text-muted-foreground text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border/50"
                  >
                    <td className="py-2.5 pr-4 text-foreground">
                      {u.email}
                      {u.id === currentUser?.id && (
                        <span className="ml-2 text-[10px] text-primary">(you)</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          u.role === "admin"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="py-2.5 text-right">
                      {u.id !== currentUser?.id && (
                        <>
                          {deleteConfirm === u.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 text-xs"
                                onClick={() => handleDelete(u.id)}
                                disabled={deleting}
                              >
                                {deleting ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                  <AlertTriangle className="mr-1 h-3 w-3" />
                                )}
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => setDeleteConfirm(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteConfirm(u.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
