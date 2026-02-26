import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProfilePage() {
  return (
    <PageShell eyebrow="Account" title="Profile" description="Workspace account details and session controls.">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Signed in as security@workspace.local.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[var(--ink-muted)]">Profile management can be expanded here without affecting scanner workflows.</p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
