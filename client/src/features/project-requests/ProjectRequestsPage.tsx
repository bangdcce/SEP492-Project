import React, { useEffect, useState } from 'react';
import { ProjectRequestsTable } from './components/ProjectRequestsTable';
import { projectRequestsApi } from './api';
import type { ProjectRequest } from './types';
import { Loader2 } from 'lucide-react';

export const ProjectRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if(userStr) setUser(JSON.parse(userStr));
  }, []);

  const myProjects = requests.filter(r => 
      // 1. Assigned directly
      r.brokerId === user?.id 
      || 
      // 2. Has ACCEPTED proposal (Meaning invited and accepted)
      r.brokerProposals?.some((p: any) => p.brokerId === user?.id && p.status === 'ACCEPTED')
  );

  // TODO: Get this from real Auth Context
  // const MOCK_BROKER_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22';

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await projectRequestsApi.getAll();
      setRequests(data);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAssign = async (requestId: string) => {
    if (!confirm('Are you sure you want to assign this request to yourself?')) return;
    
    try {
      setAssigningId(requestId);
      await projectRequestsApi.assignBroker(requestId);
      // Refresh list after successful assignment
      await fetchRequests();
      alert('Request assigned successfully!');
    } catch (error: any) {
      console.error('Failed to assign request:', error);
      alert(error.response?.data?.message || 'Failed to assign request');
    } finally {
      setAssigningId(null);
    }
  };

  const handleApply = async (requestId: string, coverLetter: string) => {
     try {
        await projectRequestsApi.applyToRequest(requestId, coverLetter);
        alert("Application submitted successfully!");
        fetchRequests();
     } catch (error: any) {
        console.error(error);
        alert(error.response?.data?.message || "Failed to apply");
     }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketplace Requests</h1>
          <p className="text-muted-foreground">
            Browse and apply to public project requests from clients.
          </p>
        </div>
      </div>
      
      <div className="rounded-md bg-white p-4 shadow-sm">
        <ProjectRequestsTable 
            requests={requests.filter(r => r.status === 'PUBLIC_DRAFT' && !r.brokerId)} 
            onAssign={handleAssign}
            onApply={handleApply}
            assigningId={assigningId}
            currentUserId={user?.id}
        />
      </div>
    </div>
  );
};
