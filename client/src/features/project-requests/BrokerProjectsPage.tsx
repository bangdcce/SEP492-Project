
import React, { useEffect, useState } from 'react';
import { ProjectRequestsTable } from './components/ProjectRequestsTable';
import { projectRequestsApi } from './api';
import type { ProjectRequest } from './types';
import { Loader2, Search } from 'lucide-react';
import { KYCBlocker, useKYCStatus } from '@/shared/components/custom/KYCBlocker';
import { STORAGE_KEYS } from '@/constants';
import { getStoredJson } from '@/shared/utils/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { Input } from '@/shared/components/ui/Input';
import { Badge } from '@/shared/components/ui/badge';

export const BrokerProjectsPage: React.FC = () => {
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { checkKycStatus } = useKYCStatus();

  useEffect(() => {
    setUser(getStoredJson(STORAGE_KEYS.USER));
    
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
  const filteredProjects = myProjects.filter((request) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      request.title.toLowerCase().includes(q) ||
      request.description.toLowerCase().includes(q) ||
      (request.techPreferences || '').toLowerCase().includes(q) ||
      (request.budgetRange || '').toLowerCase().includes(q)
    );
  });
  const readyForSpecCount = filteredProjects.filter(
    (request) =>
      request.status === 'BROKER_ASSIGNED' ||
      request.status === 'SPEC_SUBMITTED' ||
      request.status === 'SPEC_APPROVED' ||
      request.status === 'HIRING',
  ).length;
  const contractPendingCount = filteredProjects.filter(
    (request) => request.status === 'CONTRACT_PENDING',
  ).length;

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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Requests</h1>
          <p className="text-muted-foreground">
             Requests where you are the assigned broker or accepted proposal owner.
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Total</p>
            <p className="mt-1 text-2xl font-semibold">{myProjects.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Spec Workflow</p>
            <p className="mt-1 text-2xl font-semibold text-indigo-600">{readyForSpecCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Contract Pending</p>
            <p className="mt-1 text-2xl font-semibold text-amber-600">{contractPendingCount}</p>
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
                placeholder="Search by title, description, budget, tech stack..."
                className="pl-9"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <Badge variant="outline">{filteredProjects.length} results</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md bg-white p-4 shadow-sm">
         {filteredProjects.length === 0 ? (
             <div className="text-center py-10 text-muted-foreground">
                 You don't have any active projects yet. Check the Marketplace to find work!
             </div>
         ) : (
            <ProjectRequestsTable 
                requests={filteredProjects} 
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
