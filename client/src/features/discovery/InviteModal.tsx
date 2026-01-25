import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, Textarea, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/components/ui";
import { discoveryApi } from "./api";
// We need to fetch ONLY "My Requests" that are eligible for invitation.
// Reusing MyRequests logic or fetching via new endpoint if created.
// Assuming MyRequestsPage logic: api.get('/project-requests?status=...')
// Ideally we want ALL active requests (Public/Private Drafts, Pending Specs)
import api from "@/lib/axiosClient"; 
import { toast } from "sonner";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerId: string;
  partnerName: string;
  partnerRole: "BROKER" | "FREELANCER"; // Simplified role check
  defaultRequestId?: string;
}

export const InviteModal = ({ isOpen, onClose, partnerId, partnerName, partnerRole, defaultRequestId }: InviteModalProps) => {
  const [selectedRequestId, setSelectedRequestId] = useState<string>(defaultRequestId || "");
  const [message, setMessage] = useState("");

  // Fetch My Requests
  // Statuses eligible for inviting a broker: PUBLIC_DRAFT, PRIVATE_DRAFT, possibly PENDING_SPECS (if replacing)
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
      if (isOpen) {
          setIsLoadingRequests(true);
          api.get('/project-requests')
             .then((res: any) => setMyRequests(res.data))
             .catch((err: any) => console.error(err))
             .finally(() => setIsLoadingRequests(false));
      }
      if (defaultRequestId) setSelectedRequestId(defaultRequestId);
  }, [isOpen, defaultRequestId]);

  const handleInvite = async () => {
    if (!selectedRequestId) return;
    setIsSending(true);
    try {
        if (partnerRole === "BROKER") {
            await discoveryApi.inviteBroker(selectedRequestId, partnerId, message);
        } else {
            await discoveryApi.inviteFreelancer(selectedRequestId, partnerId, message);
        }
        toast.success(`Invitation sent to ${partnerName}`);
        onClose();
        setMessage("");
        setSelectedRequestId("");
    } catch (err: any) {
        toast.error(err.response?.data?.message || "Failed to send invitation");
    } finally {
        setIsSending(false);
    }
  };

  // Filter eligible requests
  // For Brokers: Request must NOT have a broker assigned already.
  // For Freelancers: Request must be in a state where hiring is possible (Phase 3+?), or just any?
  // User Requirements says: "Invite to specific request".
  // Let's filter out completed/cancelled ones.
  const eligibleRequests = myRequests?.filter((r: any) => {
      const isFinished = ["COMPLETED", "CANCELLED", "REJECTED"].includes(r.status);
      if (isFinished) return false;
      
      if (partnerRole === "BROKER") {
          // Can't invite broker if one is already assigned
          return !r.brokerId;
      }
      return true;
  }) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite {partnerName} to a Project</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <label className="text-sm font-medium">Select Project Request</label>
                <Select value={selectedRequestId} onValueChange={setSelectedRequestId}>
                    <SelectTrigger>
                        <SelectValue placeholder={isLoadingRequests ? "Loading requests..." : "Select a request"} />
                    </SelectTrigger>
                    <SelectContent>
                        {eligibleRequests.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                                No eligible requests found.
                            </div>
                        ) : (
                            eligibleRequests.map((req: any) => (
                                <SelectItem key={req.id} value={req.id}>
                                    {req.title} <span className="text-xs text-muted-foreground">({req.status})</span>
                                </SelectItem>
                            ))
                        )}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Message (Optional)</label>
                <Textarea 
                    placeholder={`Hi ${partnerName}, I'd like to invite you to discuss this project...`}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                />
            </div>
        </div>

        <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleInvite} disabled={!selectedRequestId || isSending}>
                {isSending ? "Sending..." : "Send Invitation"}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
