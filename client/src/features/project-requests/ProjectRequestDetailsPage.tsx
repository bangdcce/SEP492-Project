import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Mail, User, Calendar, DollarSign, Monitor } from 'lucide-react';

import type { ProjectRequest, RequestStatus } from './types';
import { projectRequestsApi } from './api';
import { Button } from '@/shared/components/custom/Button';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/Card';
import { Separator } from '@/shared/components/ui/separator';
import { Skeleton } from '@/shared/components/ui/skeleton';

export default function ProjectRequestDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [request, setRequest] = useState<ProjectRequest | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchRequest = async () => {
      try {
        setIsLoading(true);
        const response = await projectRequestsApi.getById(id);
        setRequest(response);
      } catch (err) {
        console.error('Failed to fetch request:', err);
        setError('Failed to load project request details.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequest();
  }, [id]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-[400px] col-span-2" />
          <Skeleton className="h-[200px]" />
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-center">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Request</h3>
            <p className="text-gray-600 mb-4">
              {error || 'Could not load the project request details.'}
            </p>
            <Button variant="outline" onClick={() => navigate('/project-requests')}>
              Back to List
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 hover:bg-red-100';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAssign = async () => {
    if (!request || !request.id) return;
    if (!confirm('Are you sure you want to assign this request to yourself?')) return;

    try {
      // Optimistically update UI or show loading
      await projectRequestsApi.assignBroker(request.id);
      
      // Update local state to reflect change
      setRequest(prev => prev ? ({ ...prev, status: 'PROCESSING', brokerId: 'me' }) : null);
      alert('Request assigned successfully!');
      
      // Navigate back or refresh? For now just stay.
    } catch (err: any) {
      console.error('Failed to assign request:', err);
      alert('Failed to assign request');
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/project-requests')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Request Details</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-xl">{request.title}</CardTitle>
                  <CardDescription>Created on {format(new Date(request.createdAt), 'PPP')}</CardDescription>
                </div>
                <Badge className={getStatusColor(request.status)}>{request.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{request.description}</p>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    <span>Budget Range</span>
                  </div>
                  <p className="font-medium text-sm">{request.budgetRange || 'Not specified'}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Intended Timeline</span>
                  </div>
                  <p className="font-medium text-sm">{request.intendedTimeline || 'Not specified'}</p>
                </div>

                <div className="col-span-1 md:col-span-2 space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Monitor className="h-4 w-4" />
                    <span>Tech Preferences</span>
                  </div>
                  <p className="font-medium text-sm">{request.techPreferences || 'None specified'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {request.answers && request.answers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Additional Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {request.answers.map((answer: any) => (
                    <div key={answer.id} className="p-4 bg-muted/50 rounded-lg space-y-2">
                       {/* Use safer access and fallback */}
                      <p className="text-sm font-medium">{answer.question?.label || 'Unknown Question'}</p>
                      <p className="text-sm text-muted-foreground">{answer.option?.label || answer.valueText || 'No Answer'}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Client Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {request.client ? (
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {request.client.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{request.client.fullName}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{request.client.email}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Client information unavailable</div>
              )}
            </CardContent>
          </Card>

          {request.spec && (
            <Card className="border-teal-200 bg-teal-50/50">
              <CardHeader>
                <CardTitle className="text-lg text-teal-900">Project Specification</CardTitle>
                <CardDescription>Submitted specification for this project.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                   <h4 className="font-semibold text-sm mb-1">Title</h4>
                   <p className="text-sm">{request.spec.title}</p>
                </div>
                <div>
                   <h4 className="font-semibold text-sm mb-1">Total Budget</h4>
                   <p className="text-sm font-medium text-teal-700">
                     {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(request.spec.totalBudget)}
                   </p>
                </div>
                <div>
                   <h4 className="font-semibold text-sm mb-2">Milestones ({request.spec.milestones?.length || 0})</h4>
                   <div className="space-y-2">
                     {request.spec.milestones?.map((m) => (
                       <div key={m.id} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-teal-100">
                         <span>{m.title}</span>
                         <span className="font-medium">
                           {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(m.amount)}
                         </span>
                       </div>
                     ))}
                   </div>
                </div>
                 <div className="pt-2">
                    <Badge variant="outline" className="bg-white border-teal-200 text-teal-700">
                      Status: {request.spec.status}
                    </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Broker Actions</CardTitle>
            </CardHeader>
            <CardContent>
              {request.status === 'PENDING' ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">This request is pending assignment.</p>
                  <Button className="w-full" onClick={handleAssign}>Assign to Me</Button>
                </div>
              ) : (
                <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                       {request.brokerId ? `Assigned to broker ID: ${request.brokerId}` : 'No broker assigned yet.'}
                    </div>
                    {/* Check if current status is PROCESSING to allow creation */}
                    {request.status === 'PROCESSING' && (
                        <Button 
                          className="w-full" 
                          onClick={() => navigate(`/project-requests/${request.id}/create-spec`)}
                        >
                          Create Specification
                        </Button>
                    )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
