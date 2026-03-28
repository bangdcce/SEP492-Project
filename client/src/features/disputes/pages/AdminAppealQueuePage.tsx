import { Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui";

export function AdminAppealQueuePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Appeal Queue
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Administrative queue for dispute appeals and escalated review work.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-indigo-600" />
            Appeals Workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>
            This route is now wired back into the app so admin navigation and
            lazy imports no longer fail at startup.
          </p>
          <p>
            The detailed appeal queue UI can be expanded here later without
            touching routing again.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminAppealQueuePage;
