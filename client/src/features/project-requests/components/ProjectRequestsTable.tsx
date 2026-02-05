import React from 'react';
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
  return (
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
                <Link to={`/project-requests/${request.id}`} className="text-teal-600 hover:underline">
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
                                onClick={() => {
                                    const letter = prompt("Enter a brief cover letter for your application:");
                                    if (letter !== null) {
                                        onApply(request.id, letter);
                                    }
                                }}
                             >
                                Apply
                             </Button>
                        );
                     })()
                )}

                <Link to={`/project-requests/${request.id}`}>
                    <Button variant="ghost" className="h-8 w-8 p-0 ml-1">
                        <span className="sr-only">View Details</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </Button>
                </Link>

                {request.status === RequestStatus.PROCESSING && (
                  <span className="text-xs text-gray-500 italic">
                    Assigned to {request.brokerId?.slice(0, 8)}...
                  </span>
                )}
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
  );
};
