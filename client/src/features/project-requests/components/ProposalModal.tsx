import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/custom/Button';
import { Textarea } from '@/shared/components/ui/textarea'; // Fallback if missing

interface ProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (letter: string) => void;
}

export const ProposalModal: React.FC<ProposalModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [letter, setLetter] = useState("I'm available to handle this request and can start immediately.");

  const handleSubmit = () => {
    if (letter.trim()) {
      onSubmit(letter.trim());
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Submit Proposal</DialogTitle>
          <DialogDescription>
            Write a short proposal message to the client outlining why you are a good fit for this project.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <textarea
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            placeholder="I'm available to handle this request and can start immediately."
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Submit Application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
