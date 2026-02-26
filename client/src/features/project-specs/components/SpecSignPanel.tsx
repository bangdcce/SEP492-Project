import { CheckCircle2, PenTool } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card';
import { Badge } from '@/shared/components/ui/badge';
import type { ProjectSpec } from '../types';
import { SpecPhase } from '../types';

interface SpecSignPanelProps {
  spec: ProjectSpec;
  currentUserId?: string;
  isSigning?: boolean;
  onSign: () => void;
}

export function SpecSignPanel({
  spec,
  currentUserId,
  isSigning = false,
  onSign,
}: SpecSignPanelProps) {
  const signedUserIds = new Set((spec.signatures || []).map((signature) => signature.userId));
  const requestData = spec.request as
    | (ProjectSpec['request'] & {
        proposals?: Array<{
          status?: string;
          freelancerId?: string;
          freelancer?: { id?: string; fullName?: string };
        }>;
        freelancerProposals?: Array<{
          status?: string;
          freelancerId?: string;
          freelancer?: { id?: string; fullName?: string };
        }>;
      })
    | undefined;

  const parties = [
    {
      label: 'Client',
      id: spec.request?.clientId,
      name: spec.request?.client?.fullName || 'Client',
    },
    {
      label: 'Broker',
      id: spec.request?.brokerId,
      name: spec.request?.broker?.fullName || 'Broker',
    },
  ];

  const signedFreelancer = (spec.signatures || []).find(
    (signature) => String(signature.signerRole || '').toUpperCase() === 'FREELANCER',
  );
  const freelancerProposalList =
    requestData?.freelancerProposals || requestData?.proposals || [];
  const acceptedFreelancerProposal =
    freelancerProposalList.find(
      (proposal) => String(proposal?.status || '').toUpperCase() === 'ACCEPTED',
    ) ||
    (() => {
      const pending = freelancerProposalList.filter(
        (proposal) => String(proposal?.status || '').toUpperCase() === 'PENDING',
      );
      return pending.length === 1 ? pending[0] : undefined;
    })();
  const freelancerPartyId =
    spec.request?.freelancerId ||
    acceptedFreelancerProposal?.freelancerId ||
    signedFreelancer?.userId;
  const freelancerPartyName =
    acceptedFreelancerProposal?.freelancer?.fullName ||
    acceptedFreelancerProposal?.freelancerId ||
    signedFreelancer?.userId ||
    'Selected freelancer';

  if (freelancerPartyId) {
    parties.push({
      label: 'Freelancer',
      id: freelancerPartyId,
      name: freelancerPartyName,
    });
  } else if (spec.specPhase === SpecPhase.FULL_SPEC) {
    parties.push({
      label: 'Freelancer',
      id: signedFreelancer?.userId,
      name: freelancerPartyName,
    });
  }

  const userAlreadySigned = currentUserId ? signedUserIds.has(currentUserId) : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Final Spec Signatures</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {parties.map((party) => (
          <div key={party.label} className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium">{party.label}</p>
              <p className="text-sm text-muted-foreground">{party.name}</p>
            </div>
            <Badge variant={party.id && signedUserIds.has(party.id) ? 'default' : 'outline'}>
              {party.id && signedUserIds.has(party.id) ? (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Signed
                </span>
              ) : (
                'Pending'
              )}
            </Badge>
          </div>
        ))}

        <Button
          className="w-full"
          onClick={onSign}
          disabled={isSigning || userAlreadySigned}
        >
          <PenTool className="mr-2 h-4 w-4" />
          {userAlreadySigned ? 'You already signed' : isSigning ? 'Signing...' : 'Sign Full Spec'}
        </Button>
      </CardContent>
    </Card>
  );
}
