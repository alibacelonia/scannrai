"use client";

import { FormEvent, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OpsCard, OpsPanel } from "@/components/ui/ops-card";
import { ApiError, changePassword } from "@/lib/api";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
      toast.error("Fill in all password fields.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      toast.success("Password changed.");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Unable to change password.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell eyebrow="Account Security" title="Change Password" description="Update your account password used for login.">
      <OpsCard
        chipDotClassName="bg-amber-500"
        chipLabel="Credentials"
        description="Use a strong unique password and avoid reusing previous credentials."
        icon={KeyRound}
        title="Password update"
        contentClassName="space-y-3"
      >
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Current password</label>
            <Input
              autoComplete="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Enter current password"
              type="password"
              value={currentPassword}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">New password</label>
            <Input
              autoComplete="new-password"
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Enter new password"
              type="password"
              value={newPassword}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Confirm new password</label>
            <Input
              autoComplete="new-password"
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              placeholder="Confirm new password"
              type="password"
              value={confirmNewPassword}
            />
          </div>
          <Button disabled={saving} type="submit">
            {saving ? "Updating..." : "Update password"}
          </Button>
        </form>
      </OpsCard>

      <OpsPanel>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <ShieldCheck className="h-4 w-4 text-slate-500" />
          <p>After changing your password, use the new password on future sign-ins.</p>
        </div>
      </OpsPanel>
    </PageShell>
  );
}
