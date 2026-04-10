import React from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Button } from '@/shared/components/custom/Button';
import type { ProjectRequest } from '../types';
import { RequestStatus } from '../types';
import { Badge } from '@/shared/components/ui/badge';
import { ArrowUpRight, Clock3, DollarSign, Eye, FilePenLine, UserPlus } from 'lucide-react';
import { ProposalModal } from './ProposalModal';

interface ProjectRequestsTableProps {
  requests: ProjectRequest[];
  onApply?: (id: string, coverLetter: string) => void;
  currentUserId?: string;
}

export const ProjectRequestsTable: React.FC<ProjectRequestsTableProps> = ({
  requests,
  onApply,
  currentUserId,
}) => {
  const [proposalModalOpen, setProposalModalOpen] = React.useState(false);
  const [selectedRequestId, setSelectedRequestId] = React.useState<string | null>(null);
  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case RequestStatus.PUBLIC_DRAFT:
      case RequestStatus.PRIVATE_DRAFT:
      case RequestStatus.PENDING:
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case RequestStatus.BROKER_ASSIGNED:
      case RequestStatus.SPEC_SUBMITTED:
      case RequestStatus.SPEC_APPROVED:
      case RequestStatus.HIRING:
      case RequestStatus.CONTRACT_PENDING:
      case RequestStatus.CONVERTED_TO_PROJECT:
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case RequestStatus.COMPLETED:
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case RequestStatus.CANCELED:
      case RequestStatus.CANCELLED:
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const formatStatus = (status?: string) => (status || 'UNKNOWN').replace(/_/g, ' ');

  const getRequestVisibility = (status?: string) => {
    if (status === RequestStatus.PUBLIC_DRAFT) return 'Public';
    if (status === RequestStatus.PRIVATE_DRAFT) return 'Private';
    return 'In Workflow';
  };

  return (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Request</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Budget & Timeline</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="max-w-[360px]">
                <div className="space-y-1">
                  <Link
                    to={`/broker/project-requests/${request.id}`}
                    className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline"
                  >
                    {request.title}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {request.description}
                  </p>
                  <div className="pt-1">
                    <Badge variant="outline" className="text-[11px]">
                      {getRequestVisibility(request.status)}
                    </Badge>
                  </div>
                </div>
              </TableCell>
              <TableCell className="max-w-[180px]">
                <div className="text-sm">
                  <p className="font-medium">{request.client?.fullName || "Client"}</p>
                  <p className="text-xs text-muted-foreground">{request.client?.email || "—"}</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1 text-sm">
                  <p className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    {request.budgetRange || "Not specified"}
                  </p>
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    {request.intendedTimeline || "Timeline TBD"}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <p>{new Date(request.createdAt).toLocaleDateString()}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNowStrict(new Date(request.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <Badge className={getStatusBadgeClass(request.status)}>
                  {formatStatus(request.status)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-wrap justify-end gap-2">
                  {request.status === RequestStatus.PUBLIC_DRAFT &&
                    onApply &&
                    (() => {
                      const hasApplied = request.brokerProposals?.some(
                        (p: any) => p.brokerId === currentUserId,
                      );

                      if (hasApplied) {
                        return (
                          <Button
                            variant="outline"
                            className="h-8 px-3 text-xs bg-muted text-muted-foreground"
                            disabled
                          >
                            Applied
                          </Button>
                        );
                      }

                      return (
                        <Button
                          variant="outline"
                          className="h-8 px-3 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                          onClick={() => {
                            setSelectedRequestId(request.id);
                            setProposalModalOpen(true);
                          }}
                        >
                          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                          Apply
                        </Button>
                      );
                    })()}

                  <Link to={`/broker/project-requests/${request.id}`}>
                    <Button variant="outline" className="h-8 px-3 text-xs">
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      Open
                    </Button>
                  </Link>

                  {request.status === RequestStatus.PROCESSING && request.brokerId && (
                    <Button variant="outline" className="h-8 px-2 text-xs text-muted-foreground" disabled>
                      <FilePenLine className="mr-1.5 h-3.5 w-3.5" />
                      In Progress
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {requests.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                No requests found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ProposalModal 
        isOpen={proposalModalOpen}
        onClose={() => {
          setProposalModalOpen(false);
          setSelectedRequestId(null);
        }}
        onSubmit={(letter) => {
          if (selectedRequestId && onApply) {
            onApply(selectedRequestId, letter);
          }
        }}
      />
    </div>
  );
};
