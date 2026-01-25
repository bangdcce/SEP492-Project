import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, PenTool, CheckCircle, Lock, FileText, Eye } from 'lucide-react';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/badge';
import Spinner from '@/shared/components/ui/Spinner';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import type { Contract } from './types';
import { contractsApi } from './api';
import { ContractPDF } from './ContractPDF';

export default function ContractPage() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState('');
  const [showPDFViewer, setShowPDFViewer] = useState(false);

  useEffect(() => {
    if (id) {
      contractsApi.getContract(id)
        .then(setContract)
        .catch(err => {
          console.error(err);
          setError('Failed to load contract');
        })
        .finally(() => setIsLoading(false));
    }
  }, [id]);

  const handleSign = async () => {
    if (!contract || !password) return;
    try {
      setIsSigning(true);
      await contractsApi.signContract(contract.id, password);
      // Reload contract
      const updated = await contractsApi.getContract(contract.id);
      setContract(updated);
      setPassword('');
      alert('Contract signed successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to sign contract. Please check your password and try again.'); // Generic error
    } finally {
      setIsSigning(false);
    }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!contract) return <div className="p-8 text-center text-red-500">{error || 'Contract not found'}</div>;

  const isSigned = contract.status === 'SIGNED' || contract.status === 'ACTIVE';
  
  // Identify missing signatures (Mock logic as we don't have current user ID easily here without context)
  // We rely on backend to tell us if WE signed based on error or status. 
  // Actually, for this view, we just show the list.

  return (
    <div className="container mx-auto py-8 max-w-6xl space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{contract.title}</h1>
          <p className="text-muted-foreground">Project ID: {contract.projectId}</p>
        </div>
        <div className="flex gap-2">
           <Badge variant={isSigned ? 'default' : 'outline'} className="text-lg px-4 py-1">
             {contract.status}
           </Badge>
           <Button variant="outline" onClick={() => setShowPDFViewer(!showPDFViewer)}>
             <Eye className="w-4 h-4 mr-2" /> {showPDFViewer ? 'Hide' : 'Preview'} PDF
           </Button>
           <PDFDownloadLink 
             document={<ContractPDF contract={contract} />} 
             fileName={`contract-${contract.id}.pdf`}
           >
             {({ loading }) => (
               <Button variant="outline" disabled={loading}>
                 <Download className="w-4 h-4 mr-2" />
                 {loading ? 'Generating...' : 'Download PDF'}
               </Button>
             )}
           </PDFDownloadLink>
        </div>
      </div>

      {/* PDF Viewer */}
      {showPDFViewer && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>PDF Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full h-[600px] border rounded">
              <PDFViewer width="100%" height="100%">
                <ContractPDF contract={contract} />
              </PDFViewer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Contract Content (Left) */}
        <div className="md:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" /> Terms & Conditions
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto max-h-[70vh] bg-muted/20 p-6 rounded-md font-mono text-sm whitespace-pre-wrap">
              {contract.termsContent}
            </CardContent>
          </Card>
        </div>

        {/* Actions (Right) */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Signatures</CardTitle>
              <CardDescription>Both parties must sign to activate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${contract.signatures?.some(s => s.userId === contract.project?.clientId) ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                   <CheckCircle className="w-5 h-5" />
                 </div>
                 <div>
                   <p className="font-semibold">Client</p>
                   {contract.project?.client?.fullName || 'Client'}
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${contract.signatures?.some(s => s.userId === contract.project?.brokerId) ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                   <CheckCircle className="w-5 h-5" />
                 </div>
                 <div>
                   <p className="font-semibold">Broker (Lead)</p>
                   {contract.project?.broker?.fullName || 'Broker'}
                 </div>
              </div>
            </CardContent>
          </Card>

          {!isSigned && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <PenTool className="w-5 h-5" /> Sign Contract
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="bg-white">
                  <Lock className="w-4 h-4" />
                  <AlertTitle>Legal Binding</AlertTitle>
                  <AlertDescription className="text-xs">
                    By signing, you agree to the terms listed. This action creates a cryptographic hash of the document and your identity.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="password">Confirm Password</Label>
                  <Input 
                    type="password" 
                    id="password" 
                    placeholder="Enter your password to sign"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" onClick={handleSign} disabled={!password || isSigning}>
                  {isSigning ? 'Signing...' : 'Digitally Sign Contract'}
                </Button>
              </CardFooter>
            </Card>
          )}

          {isSigned && (
             <Alert className="bg-green-50 border-green-200 text-green-800">
               <CheckCircle className="w-4 h-4 text-green-600" />
               <AlertTitle>Contract Active</AlertTitle>
               <AlertDescription>
                 This project has been activated. Work can commence defined in milestones.
               </AlertDescription>
             </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
