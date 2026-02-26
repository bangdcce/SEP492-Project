
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, Button, Badge, Input, Spinner } from '@/shared/components/ui';
import { wizardService } from '../wizard/services/wizardService';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ROUTES } from '@/constants';
import { Search } from 'lucide-react';
import { RequestStatus } from "../requests/types";
import { projectSpecsApi } from '@/features/project-specs/api';
import type { ProjectSpec } from '@/features/project-specs/types';
import { ProjectSpecStatus, SpecPhase } from '@/features/project-specs/types';

type RequestSpecFlow = {
  clientSpec: ProjectSpec | null;
  fullSpec: ProjectSpec | null;
};

const pickLatestSpecByPhase = (specs: ProjectSpec[], phase: SpecPhase): ProjectSpec | null =>
  [...specs]
    .filter((spec) => spec.specPhase === phase)
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime(),
    )[0] ?? null;

export function MyRequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [specFlowsByRequestId, setSpecFlowsByRequestId] = useState<Record<string, RequestSpecFlow>>({});

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const data = await wizardService.getRequests();
      setRequests(data);
      void fetchSpecFlows(data);
    } catch (error) {
      console.error("Failed to fetch requests", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecFlows = async (requestList: any[]) => {
    const shouldCheckSpecs = (status: string) =>
      ![
        RequestStatus.DRAFT,
        RequestStatus.PUBLIC_DRAFT,
        RequestStatus.PRIVATE_DRAFT,
        RequestStatus.CANCELED,
      ].includes(status as any);

    const targetRequests = requestList.filter((request) => shouldCheckSpecs(request.status));
    if (targetRequests.length === 0) {
      setSpecFlowsByRequestId({});
      return;
    }

    const results = await Promise.allSettled(
      targetRequests.map(async (request) => {
        const specs = await projectSpecsApi.getSpecsByRequest(request.id);
        const clientSpec = pickLatestSpecByPhase(specs, SpecPhase.CLIENT_SPEC);
        const fullSpec = pickLatestSpecByPhase(specs, SpecPhase.FULL_SPEC);
        return { requestId: request.id, clientSpec, fullSpec };
      }),
    );

    const nextMap: Record<string, RequestSpecFlow> = {};

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      nextMap[result.value.requestId] = {
        clientSpec: result.value.clientSpec,
        fullSpec: result.value.fullSpec,
      };
    }

    setSpecFlowsByRequestId(nextMap);
  };

  const filteredRequests = requests.filter(r => {
      // Logic for status filtering incuding drafts
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'DRAFT') return r.status.includes('DRAFT');
      if (statusFilter === 'PENDING') {
        return (
          r.status === RequestStatus.PENDING ||
          r.status === RequestStatus.PENDING_SPECS ||
          r.status === RequestStatus.SPEC_SUBMITTED
        );
      }
      if (statusFilter === 'IN_PROGRESS') {
        return (
          r.status === RequestStatus.CONVERTED_TO_PROJECT ||
          r.status === RequestStatus.IN_PROGRESS
        );
      }
      return r.status === statusFilter;
      
      const matchesSearch = r.title?.toLowerCase().includes(search.toLowerCase()) || 
                            r.description?.toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
  });
  
  // Fix filtering logic combination
  const finalFilteredRequests = filteredRequests.filter(r => {
      return r.title?.toLowerCase().includes(search.toLowerCase()) || 
             r.description?.toLowerCase().includes(search.toLowerCase());
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case RequestStatus.DRAFT:
      case RequestStatus.PUBLIC_DRAFT:
      case RequestStatus.PRIVATE_DRAFT: 
        return 'bg-gray-100 text-gray-800';
      case RequestStatus.PENDING:
      case RequestStatus.PENDING_SPECS: 
      case RequestStatus.SPEC_SUBMITTED:
        return 'bg-yellow-100 text-yellow-800';
      case RequestStatus.HIRING: 
      case RequestStatus.CONVERTED_TO_PROJECT:
      case RequestStatus.IN_PROGRESS:
        return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSpecBadgeClass = (status: string) => {
    switch (status) {
      case ProjectSpecStatus.CLIENT_REVIEW:
      case ProjectSpecStatus.FINAL_REVIEW:
        return 'bg-amber-100 text-amber-800';
      case ProjectSpecStatus.CLIENT_APPROVED:
      case ProjectSpecStatus.ALL_SIGNED:
      case ProjectSpecStatus.APPROVED:
        return 'bg-emerald-100 text-emerald-800';
      case ProjectSpecStatus.REJECTED:
        return 'bg-rose-100 text-rose-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
  );

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
           <h1 className="text-3xl font-bold tracking-tight">My Requests</h1>
           <p className="text-muted-foreground mt-1">Track and manage all your project requests.</p>
        </div>
        <Button onClick={() => navigate(ROUTES.CLIENT_WIZARD)}>New Request</Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between">
        <div className="flex gap-2 overflow-x-auto pb-2">
            {['ALL', 'DRAFT', 'PENDING', 'HIRING', 'IN_PROGRESS'].map(status => (
                <Button 
                    key={status}
                    variant={statusFilter === status ? 'default' : 'outline'}
                    onClick={() => setStatusFilter(status)}
                    size="sm"
                    className="whitespace-nowrap"
                >
                    {status.replace('_', ' ')}
                </Button>
            ))}
        </div>
        <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                type="search"
                placeholder="Search requests..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {finalFilteredRequests.map(request => (
            (() => {
              const specFlow = specFlowsByRequestId[request.id];
              const clientSpec = specFlow?.clientSpec ?? null;
              const fullSpec = specFlow?.fullSpec ?? null;
              const canReviewClientSpec = clientSpec?.status === ProjectSpecStatus.CLIENT_REVIEW;
              const canReviewOrSignFinalSpec =
                fullSpec &&
                (fullSpec.status === ProjectSpecStatus.FINAL_REVIEW ||
                  fullSpec.status === ProjectSpecStatus.ALL_SIGNED);

              return (
            <Card key={request.id} className="hover:shadow-md transition-shadow flex flex-col h-full">
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-start mb-2">
                        <Badge className={`${getStatusColor(request.status)} border-0`}>
                            {request.status.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                            {format(new Date(request.createdAt), 'MMM d, yyyy')}
                        </span>
                    </div>
                    <h3 className="font-semibold text-lg leading-tight line-clamp-2" title={request.title}>
                        {request.title || 'Untitled Draft'}
                    </h3>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
                        {request.description || 'No description provided.'}
                    </p>
                    <div className="mb-4 rounded-lg border bg-muted/20 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Spec Workflow
                            </p>
                            {canReviewClientSpec && (
                                <Badge className="bg-amber-100 text-amber-800 border-0">Client action needed</Badge>
                            )}
                        </div>
                        <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Client Spec</span>
                                {clientSpec ? (
                                    <Badge className={`${getSpecBadgeClass(clientSpec.status)} border-0`}>
                                        {clientSpec.status.replace(/_/g, ' ')}
                                    </Badge>
                                ) : (
                                    <span className="text-muted-foreground">Waiting broker draft</span>
                                )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">full_spec</span>
                                {fullSpec ? (
                                    <Badge className={`${getSpecBadgeClass(fullSpec.status)} border-0`}>
                                        {fullSpec.status.replace(/_/g, ' ')}
                                    </Badge>
                                ) : (
                                    <span className="text-muted-foreground">Not started</span>
                                )}
                            </div>
                        </div>
                        <div className="mt-3 space-y-2">
                            {canReviewClientSpec && clientSpec && (
                                <Button
                                    size="sm"
                                    className="w-full"
                                    onClick={() => navigate(`/client/spec-review/${clientSpec.id}`)}
                                >
                                    Review Client Spec
                                </Button>
                            )}
                            {canReviewOrSignFinalSpec && fullSpec && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => navigate(`/client/spec-review/${fullSpec.id}`)}
                                >
                                    {fullSpec.status === ProjectSpecStatus.FINAL_REVIEW
                                      ? 'Review & Sign Final Spec'
                                      : 'View Final Spec'}
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="mt-auto pt-4 border-t">
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                className="w-full"
                                onClick={() => navigate(`/client/requests/${request.id}`)}
                            >
                                {(request.status === RequestStatus.DRAFT || request.status === RequestStatus.PUBLIC_DRAFT || request.status === RequestStatus.PRIVATE_DRAFT) ? 'View Draft' : 'View Details'}
                            </Button>
                    </div>
                </CardContent>
            </Card>
              );
            })()
        ))}
        {finalFilteredRequests.length === 0 && (
            <div className="col-span-full py-16 text-center text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
                <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Search className="w-6 h-6 opacity-50" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No requests found</h3>
                <p className="mb-4">Try adjusting your filters or create a new request.</p>
                <Button variant="outline" onClick={() => navigate(ROUTES.CLIENT_WIZARD)}>Create New Request</Button>
            </div>
        )}
      </div>
    </div>
  );
}
