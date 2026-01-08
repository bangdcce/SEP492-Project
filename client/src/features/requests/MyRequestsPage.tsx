
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, Button, Badge, Spinner } from '@/shared/components/ui';
import { wizardService } from '../wizard/services/wizardService';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export function MyRequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  const filteredRequests = statusFilter === 'ALL' 
    ? requests 
    : requests.filter(r => r.status === statusFilter);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Spinner size="lg" /></div>;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
           <h1 className="text-3xl font-bold tracking-tight">My Requests</h1>
           <p className="text-muted-foreground mt-1">Track and manage all your project requests.</p>
        </div>
        <Button onClick={() => navigate('/wizard')}>New Request</Button>
      </div>

      <div className="flex gap-2 mb-6">
        {['ALL', 'DRAFT', 'PENDING', 'APPROVED'].map(status => (
            <Button 
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                onClick={() => setStatusFilter(status)}
                size="sm"
            >
                {status}
            </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredRequests.map(request => (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                        <Badge className={`${getStatusColor(request.status)} border-0`}>
                            {request.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                            {format(new Date(request.createdAt), 'MMM d, yyyy')}
                        </span>
                    </div>
                    <h3 className="font-semibold text-lg leading-tight mt-2 line-clamp-2">
                        {request.title || 'Untitled Draft'}
                    </h3>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4 h-15">
                        {request.description || 'No description provided.'}
                    </p>
                    <div className="flex justify-end gap-2">
                        {request.status === 'DRAFT' ? (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-full"
                                onClick={() => navigate(`/wizard?draftId=${request.id}`)}
                            >
                                Continue Edit
                            </Button>
                        ) : (
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                className="w-full"
                                onClick={() => navigate(`/requests/${request.id}`)}
                            >
                                View Details
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        ))}
        {filteredRequests.length === 0 && (
            <div className="col-span-full py-10 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                <p>No requests found.</p>
                <Button variant="link" onClick={() => navigate('/wizard')}>Create a new request</Button>
            </div>
        )}
      </div>
    </div>
  );
}
