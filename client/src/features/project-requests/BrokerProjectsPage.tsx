
import React, { useEffect, useState } from 'react';
import { ProjectRequestsTable } from './components/ProjectRequestsTable';
import { projectRequestsApi } from './api';
import type { ProjectRequest } from './types';
import { Loader2 } from 'lucide-react';
import { KYCBlocker, useKYCStatus } from '@/shared/components/custom/KYCBlocker';

export const BrokerProjectsPage: React.FC = () => {
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const { checkKycStatus } = useKYCStatus();

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if(userStr) setUser(JSON.parse(userStr));
    
    // Check KYC status
    checkKycStatus().then(setKycStatus);
  }, []);

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

  // Filter for My Projects (Assigned OR Accepted Proposal)
  const myProjects = requests.filter(r => 
      // 1. Assigned directly
      r.brokerId === user?.id 
      || 
      // 2. Has ACCEPTED proposal (Meaning invited and accepted)
      r.brokerProposals?.some((p: any) => p.brokerId === user?.id && p.status === 'ACCEPTED')
  );

  const handleAssign = async (requestId: string) => {
    // Re-implementation of assign logic if needed locally, although usually "My Projects" are already assigned/accepted.
    // Keeping it here just in case status changes or needed.
     if (!confirm('Are you sure you want to assign this request to yourself?')) return;
    
    try {
      setAssigningId(requestId);
      await projectRequestsApi.assignBroker(requestId);
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
     // Re-implement apply if they can re-apply or apply to others here? Unlikely but good to have signature match.
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

  // Block access if KYC not approved
  if (kycStatus && kycStatus !== 'APPROVED') {
    return (
      <KYCBlocker 
        kycStatus={kycStatus} 
        role="broker" 
        action="manage project requests"
      />
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Projects</h1>
          <p className="text-muted-foreground">
             Projects where you are the Assigned Broker or have an Accepted Invitation.
          </p>
        </div>
      </div>
      
      <div className="rounded-md bg-white p-4 shadow-sm">
         {myProjects.length === 0 ? (
             <div className="text-center py-10 text-muted-foreground">
                 You don't have any active projects yet. Check the Marketplace to find work!
             </div>
         ) : (
            <ProjectRequestsTable 
                requests={myProjects} 
                onAssign={handleAssign}
                onApply={handleApply}
                assigningId={assigningId}
                currentUserId={user?.id}
            />
         )}
      </div>
    </div>
  );
};
