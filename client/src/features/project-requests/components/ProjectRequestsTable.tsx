import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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
import { format } from 'date-fns';
import { ApplyToRequestModal } from './ApplyToRequestModal';
import { Eye } from 'lucide-react';

interface ProjectRequestsTableProps {
  requests: ProjectRequest[];
  onAssign: (id: string) => void;
  onApply?: (id: string, coverLetter: string) => void;
  assigningId: string | null;
  currentUserId?: string;
}

export const ProjectRequestsTable: React.FC<ProjectRequestsTableProps> = ({
  requests,
  onAssign,
  onApply,
  assigningId,
  currentUserId,
}) => {
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const handleOpenApply = (requestId: string) => {
    setSelectedRequestId(requestId);
    setIsApplyModalOpen(true);
  };

  const handleApplySubmit = (coverLetter: string, resumeId?: string) => {
    if (selectedRequestId && onApply) {
        // You might want to handle resumeId later
        console.log("Applying with resume:", resumeId);
        onApply(selectedRequestId, coverLetter);
        setIsApplyModalOpen(false);
    }
  };

  return (
    <>
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Client ID</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="font-medium">
                <Link to={`/broker/project-requests/${request.id}`} className="text-teal-600 hover:underline">
                  {request.title}
                </Link>
              </TableCell>
              <TableCell className="max-w-xs truncate">
                {request.description}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {request.clientId.slice(0, 8)}...
              </TableCell>
              <TableCell>
                {format(new Date(request.createdAt), 'PPP')}
              </TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    request.status === RequestStatus.PENDING
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {request.status}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2 items-center">
                    {request.status === RequestStatus.PENDING && (
                    <Button
                        onClick={() => onAssign(request.id)}
                        disabled={assigningId === request.id}
                    >
                        {assigningId === request.id ? 'Assigning...' : 'Assign'}
                    </Button>
                    )}
                    
                    
                    {/* Apply Button for Brokers */}
                    {request.status === RequestStatus.PUBLIC_DRAFT && onApply && (
                        (() => {
                            const hasApplied = request.brokerProposals?.some((p: any) => p.brokerId === currentUserId);
                            
                            if (hasApplied) {
                                return <Button variant="outline" className="h-8 px-3 text-xs bg-muted text-muted-foreground" disabled>Applied</Button>;
                            }

                            return (
                                <Button
                                    variant="outline"
                                    className="h-8 px-3 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                    onClick={() => handleOpenApply(request.id)}
                                >
                                    Apply
                                </Button>
                            );
                        })()
                    )}

                    <Link to={`/broker/project-requests/${request.id}`}>
                        <Button variant="secondary" className="h-8 text-xs">
                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                            View Details
                        </Button>
                    </Link>
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
    </div>

    <ApplyToRequestModal 
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        onApply={handleApplySubmit}
    />
    </>
  );
};

