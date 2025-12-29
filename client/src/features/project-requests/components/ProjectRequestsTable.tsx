import React from 'react';
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
  assigningId: string | null;
}

export const ProjectRequestsTable: React.FC<ProjectRequestsTableProps> = ({
  requests,
  onAssign,
  assigningId,
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
              <TableCell className="font-medium">{request.title}</TableCell>
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
