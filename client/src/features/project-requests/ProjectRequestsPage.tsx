import React, { useEffect, useState } from 'react';
import { ProjectRequestsTable } from './components/ProjectRequestsTable';
import { projectRequestsApi } from './api';
import type { ProjectRequest } from './types';
import { Loader2, Search } from 'lucide-react';
import { KYCBlocker, useKYCStatus } from '@/shared/components/custom/KYCBlocker';
import { STORAGE_KEYS } from '@/constants';
import { getStoredJson } from '@/shared/utils/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { UpgradeModal, parseQuotaError } from '@/features/subscriptions';
import toast from 'react-hot-toast';

export const ProjectRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignConfirmId, setAssignConfirmId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [upgradeModalData, setUpgradeModalData] = useState<any>(null);
  const { checkKycStatus } = useKYCStatus();

  useEffect(() => {
    setUser(getStoredJson(STORAGE_KEYS.USER));
    
    // Check KYC status
    checkKycStatus().then(setKycStatus);
  }, []);

  const myProjects = requests.filter(r => 
      // 1. Assigned directly
      r.brokerId === user?.id 
      || 
      // 2. Has ACCEPTED proposal (Meaning invited and accepted)
      r.brokerProposals?.some((p: any) => p.brokerId === user?.id && p.status === 'ACCEPTED')
  );
  const marketRequests = requests.filter((r) => r.status === 'PUBLIC_DRAFT' && !r.brokerId);
  const filteredMarketRequests = marketRequests.filter((request) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      request.title.toLowerCase().includes(q) ||
      request.description.toLowerCase().includes(q) ||
      (request.techPreferences || '').toLowerCase().includes(q) ||
      (request.budgetRange || '').toLowerCase().includes(q)
    );
  });
  const appliedCount = marketRequests.filter((request) =>
    request.brokerProposals?.some((proposal: any) => proposal.brokerId === user?.id),
  ).length;

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
    setAssignConfirmId(requestId);
  };

  const confirmAssign = async () => {
    if (!assignConfirmId) return;

    try {
      setAssigningId(assignConfirmId);
      await projectRequestsApi.assignBroker(assignConfirmId);
      // Refresh list after successful assignment
      await fetchRequests();
      setAssignConfirmId(null);
      toast.success('Request assigned successfully!');
    } catch (error: any) {
      console.error('Failed to assign request:', error);
      const quotaErr = parseQuotaError(error);
      if (quotaErr) {
        setUpgradeModalData(quotaErr);
      } else {
        toast.error(error.response?.data?.message || 'Failed to assign request');
      }
    } finally {
      setAssigningId(null);
    }
  };

  const handleApply = async (requestId: string, coverLetter: string) => {
     try {
        await projectRequestsApi.applyToRequest(requestId, coverLetter);
        toast.success("Application submitted successfully!");
        fetchRequests();
     } catch (error: any) {
        console.error(error);
        const quotaErr = parseQuotaError(error);
        if (quotaErr) {
          setUpgradeModalData(quotaErr);
        } else {
          toast.error(error.response?.data?.message || "Failed to apply");
        }
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
        action="apply to project requests"
      />
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Broker Marketplace</h1>
          <p className="text-muted-foreground">
            Review open client requests, then assign or apply with your proposal.
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Open Requests</p>
            <p className="mt-1 text-2xl font-semibold">{marketRequests.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Your Applications</p>
            <p className="mt-1 text-2xl font-semibold text-indigo-600">{appliedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Active My Requests</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-600">{myProjects.length}</p>
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
            <Badge variant="outline">{filteredMarketRequests.length} results</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md bg-white p-4 shadow-sm">
        <ProjectRequestsTable 
            requests={filteredMarketRequests}
            onAssign={handleAssign}
            onApply={handleApply}
            assigningId={assigningId}
            currentUserId={user?.id}
        />
      </div>
      <UpgradeModal
        isOpen={!!upgradeModalData}
        onClose={() => setUpgradeModalData(null)}
        quotaInfo={upgradeModalData}
      />
      <AlertDialog open={Boolean(assignConfirmId)} onOpenChange={(open) => !open && setAssignConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign this request to yourself?</AlertDialogTitle>
            <AlertDialogDescription>
              You will become the active broker responsible for the client spec and downstream handoff flow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(assigningId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAssign} disabled={Boolean(assigningId)}>
              {assigningId ? 'Assigning...' : 'Assign to Me'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
