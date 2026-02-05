import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components/custom/Button';
import { CreateProjectSpecForm } from './components/CreateProjectSpecForm';
import { projectRequestsApi } from '../project-requests/api';
import { projectSpecsApi } from './api';
import type { ProjectRequest } from '../project-requests/types';
import type { CreateProjectSpecDTO } from './types';
import Spinner from '@/shared/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';

export default function CreateProjectSpecPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [request, setRequest] = useState<ProjectRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    console.log('[CreateProjectSpecPage] URL param id:', id, 'type:', typeof id);
    if (!id) {
      console.error('[CreateProjectSpecPage] No id from URL params!');
      return;
    }
    const fetchRequest = async () => {
      try {
        setIsLoading(true);
        const data = await projectRequestsApi.getById(id);
        console.log('[CreateProjectSpecPage] Fetched request:', data);
        setRequest(data);
      } catch (err) {
        console.error('Failed to fetch request:', err);
        setError('Could not load project request details.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchRequest();
  }, [id]);

  const handleSubmit = async (data: CreateProjectSpecDTO) => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      const newSpec = await projectSpecsApi.createSpec(data);
      console.log('Spec created:', newSpec);
      // Redirect to request details or the new spec details (when we have a page for it)
      // For now back to request details
      alert('Project Specification created successfully!');
      navigate(`/project-requests/${id}`);
    } catch (err) {
      console.error('Failed to create spec:', err);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message = (err as any).response?.data?.message || 'Failed to create project specification.';
      setSubmitError(message);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || 'Request not found'}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/project-requests')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Requests
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-6">
       <div className="flex items-center gap-4">
        <Button variant="outline" className="h-9 w-9 p-0" onClick={() => navigate(`/project-requests/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Specification</h1>
          <p className="text-muted-foreground">For request: {request.title}</p>
        </div>
      </div>

      {submitError && (
         <Alert variant="destructive">
            <AlertTitle>Submission Error</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
         </Alert>
      )}

      <CreateProjectSpecForm 
        requestId={id!} // Validated by useEffect
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
