import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Inbox, Loader2, Search } from 'lucide-react';
import { format } from 'date-fns';
import { projectRequestsApi } from '@/features/project-requests/api';
import type { FreelancerRequestAccessItem } from '@/features/project-requests/types';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { Input } from '@/shared/components/ui/Input';

const normalizeProposalStatus = (status?: string | null) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PENDING') return 'ACCEPTED (LEGACY)';
  return normalized || 'UNKNOWN';
};

const badgeClassByProposalStatus = (status?: string | null) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'ACCEPTED' || normalized === 'PENDING') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }
  if (normalized === 'INVITED') {
    return 'bg-amber-100 text-amber-800 border-amber-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

export default function FreelancerRequestsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<FreelancerRequestAccessItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const fetchList = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await projectRequestsApi.getFreelancerRequestAccessList();
        setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load freelancer request access list:', err);
        setError('Could not load your request list.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchList();
  }, []);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;

    return items.filter((item) => {
      const request = item.request;
      const haystack = [
        request?.title,
        request?.description,
        request?.client?.fullName,
        request?.broker?.fullName,
        request?.status,
        item.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [items, query]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invited Requests</h1>
          <p className="text-sm text-muted-foreground">
            Re-open requests where you are invited or selected, then continue spec review/signing.
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search requests..."
            className="pl-9"
          />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!error && items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No invited requests yet</p>
              <p className="text-sm text-muted-foreground">
                Accepted and pending invitations will appear here so you can return later.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/freelancer/invitations')}>
              Open Invitations
            </Button>
          </CardContent>
        </Card>
      )}

      {filteredItems.length === 0 && items.length > 0 && (
        <Alert>
          <AlertTitle>No results</AlertTitle>
          <AlertDescription>
            No requests matched your search. Try a different keyword.
          </AlertDescription>
        </Alert>
      )}

      {filteredItems.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredItems.map((item) => {
            const request = item.request;
            const requestId = request?.id || item.requestId;
            const canOpenRequest = Boolean(requestId);

            return (
              <Card key={item.id} className="border-slate-200">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="line-clamp-2 text-lg">
                        {request?.title || 'Untitled Request'}
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Access granted {format(new Date(item.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <Briefcase className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={badgeClassByProposalStatus(item.status)}>
                      Freelancer: {normalizeProposalStatus(item.status)}
                    </Badge>
                    {request?.status && (
                      <Badge variant="outline">{request.status.replace(/_/g, ' ')}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {request?.description || 'Open request detail to see current spec and contract workflow.'}
                  </p>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Client:</span>{' '}
                      {request?.client?.fullName || 'Unknown'}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Broker:</span>{' '}
                      {request?.broker?.fullName || 'Pending assignment'}
                    </p>
                    {request?.budgetRange && (
                      <p>
                        <span className="text-muted-foreground">Budget:</span> {request.budgetRange}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canOpenRequest ? (
                      <Button onClick={() => navigate(`/freelancer/requests/${requestId}`)}>
                        Open Request
                      </Button>
                    ) : (
                      <Button disabled>Request unavailable</Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => navigate('/freelancer/invitations')}
                    >
                      View Invitations
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
