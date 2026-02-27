import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSignature, Search, ArrowRight, Clock3, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Badge } from '@/shared/components/ui/badge';
import Spinner from '@/shared/components/ui/Spinner';
import { contractsApi } from './api';
import type { ContractSummary } from './types';
import { getStoredJson } from '@/shared/utils/storage';
import { STORAGE_KEYS } from '@/constants';

export default function ContractListPage() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const currentUser = getStoredJson<{ role?: string }>(STORAGE_KEYS.USER);
  const roleBasePath =
    currentUser?.role?.toUpperCase() === 'CLIENT'
      ? '/client'
      : currentUser?.role?.toUpperCase() === 'FREELANCER'
        ? '/freelancer'
        : '/broker';

  const pageTitle =
    roleBasePath === '/client'
      ? 'My Contracts'
      : roleBasePath === '/freelancer'
        ? 'Assigned Contracts'
        : 'Contracts Management';

  useEffect(() => {
    const fetchContracts = async () => {
      try {
        setIsLoading(true);
        const res = await contractsApi.listContracts();
        setContracts(Array.isArray(res) ? res : []);
      } catch (err) {
        console.error("Failed to fetch contracts", err);
        setContracts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContracts();
  }, []);

  const filtered = contracts.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.projectTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const signedCount = contracts.filter((c) => c.status === 'SIGNED' || c.status === 'ACTIVE').length;
  const pendingCount = contracts.length - signedCount;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
            {pageTitle}
          </h1>
          <p className="text-gray-500">Review, sign, and track legal agreements</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Total</p>
            <p className="mt-2 text-2xl font-semibold">{contracts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Pending Signatures</p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-amber-600">
              <Clock3 className="h-5 w-5" />
              {pendingCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Signed</p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-semibold text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              {signedCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
           <div className="relative w-full max-w-sm">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
             <Input 
               placeholder="Search contracts..." 
               className="pl-9"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
           </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileSignature className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p>No contracts found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(contract => (
                <div key={contract.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      <FileSignature className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{contract.title}</h3>
                      <p className="text-sm text-gray-500">{contract.projectTitle} • {contract.clientName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={contract.status === 'SIGNED' ? 'default' : 'outline'}>
                      {contract.status}
                    </Badge>
                    {(Boolean(contract.activatedAt) ||
                      ["IN_PROGRESS", "TESTING", "COMPLETED", "PAID", "DISPUTED"].includes(
                        String(contract.projectStatus || "").toUpperCase(),
                      )) && (
                      <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                        Activated
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`${roleBasePath}/contracts/${contract.id}`)}
                    >
                      View <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    {(Boolean(contract.activatedAt) ||
                      ["IN_PROGRESS", "TESTING", "COMPLETED", "PAID", "DISPUTED"].includes(
                        String(contract.projectStatus || "").toUpperCase(),
                      )) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`${roleBasePath}/workspace/${contract.projectId}`)}
                      >
                        Workspace
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
