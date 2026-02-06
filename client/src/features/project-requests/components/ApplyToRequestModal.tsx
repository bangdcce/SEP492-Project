import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";

interface ApplyToRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (coverLetter: string, resumeId?: string) => void;
  isLoading?: boolean;
}

// Mock Resumes for now (Later fetch from User Profile)

export const ApplyToRequestModal = ({
  isOpen,
  onClose,
  onApply,
  isLoading = false,
}: ApplyToRequestModalProps) => {
  const [coverLetter, setCoverLetter] = useState("");
  // const [selectedResume, setSelectedResume] = useState<string>("");

  const handleSubmit = () => {
    onApply(coverLetter); // Removed resumeId
    setCoverLetter("");
    // setSelectedResume("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Apply to Project</DialogTitle>
          <DialogDescription>
            Submit your proposal and profile to the client.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* <div className="grid gap-2">
            <Label htmlFor="resume">Select Resume / Profile</Label>
            <Select value={selectedResume} onValueChange={setSelectedResume}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a resume to attach" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_RESUMES.map((resume) => (
                  <SelectItem key={resume.id} value={resume.id}>
                    {resume.name}
                  </SelectItem>
                ))}
                <SelectItem value="new">+ Upload New Resume (Mock)</SelectItem>
              </SelectContent>
            </Select>
          </div> */}

          <div className="grid gap-2">
            <Label htmlFor="cover-letter">Cover Letter</Label>
            <Textarea
              id="cover-letter"
              placeholder="Why are you a good fit for this project?"
              className="resize-none"
              rows={5}
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!coverLetter.trim() || isLoading}>
            {isLoading ? "Submitting..." : "Submit Application"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
