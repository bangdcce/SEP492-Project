import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { ProjectRequestsTable } from "./components/ProjectRequestsTable";
import { projectRequestsApi } from "./api";
import type { FreelancerRequestAccessItem, ProjectRequest } from "./types";

export default function FreelancerMarketplacePage() {
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [accessItems, setAccessItems] = useState<FreelancerRequestAccessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchMarketplace = async () => {
      try {
        setLoading(true);
        setError(null);

        const [marketplaceRequests, requestAccessItems] = await Promise.all([
          projectRequestsApi.getFreelancerMarketplace(),
          projectRequestsApi.getFreelancerRequestAccessList(),
        ]);

        setRequests(Array.isArray(marketplaceRequests) ? marketplaceRequests : []);
        setAccessItems(Array.isArray(requestAccessItems) ? requestAccessItems : []);
      } catch (loadError) {
        console.error("Failed to load freelancer marketplace:", loadError);
        setError("Could not load the freelancer marketplace.");
      } finally {
        setLoading(false);
      }
    };

    void fetchMarketplace();
  }, []);

  const filteredRequests = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return requests;
    }

    return requests.filter((request) =>
      [
        request.title,
        request.description,
        request.client?.fullName,
        request.broker?.fullName,
        request.techPreferences,
        request.budgetRange,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [requests, searchTerm]);

  const invitedCount = accessItems.filter(
    (item) => String(item.status || "").toUpperCase() === "INVITED",
  ).length;
  const activeAccessCount = accessItems.filter((item) =>
    ["INVITED", "ACCEPTED", "PENDING"].includes(String(item.status || "").toUpperCase()),
  ).length;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Freelancer Marketplace</h1>
          <p className="text-muted-foreground">
            Browse only phase-3 requests where the broker is actively hiring a freelancer.
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Open Phase 3 Requests</p>
            <p className="mt-1 text-2xl font-semibold">{requests.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Pending Invitations</p>
            <p className="mt-1 text-2xl font-semibold text-indigo-600">{invitedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Request Access</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-600">{activeAccessCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title, description, client, broker, budget..."
                className="pl-9"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <Badge variant="outline">{filteredRequests.length} results</Badge>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!error && filteredRequests.length === 0 && (
        <Alert className="mb-4">
          <AlertTitle>No open phase-3 requests</AlertTitle>
          <AlertDescription>
            Check back later or watch your invitations for requests where a broker has already invited you in.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-md bg-white p-4 shadow-sm">
        <ProjectRequestsTable
          requests={filteredRequests}
          requestHrefBuilder={(request) => `/freelancer/requests/${request.id}`}
        />
      </div>
    </div>
  );
}
