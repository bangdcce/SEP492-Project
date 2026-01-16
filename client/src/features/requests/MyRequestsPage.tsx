
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, Button, Badge, Input, Spinner } from '@/shared/components/ui';
import { wizardService } from '../wizard/services/wizardService';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ROUTES } from '@/constants';
import { Search } from 'lucide-react';
import { RequestStatus } from "../requests/types";

export function MyRequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const data = await wizardService.getRequests();
      setRequests(data);
    } catch (error) {
      console.error("Failed to fetch requests", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter(r => {
      // Logic for status filtering incuding drafts
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'DRAFT') return r.status.includes('DRAFT');
      if (statusFilter === 'PENDING') return r.status === RequestStatus.PENDING || r.status === RequestStatus.PENDING_SPECS;
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
        return 'bg-yellow-100 text-yellow-800';
      case RequestStatus.HIRING: 
      case RequestStatus.IN_PROGRESS:
        return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
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
