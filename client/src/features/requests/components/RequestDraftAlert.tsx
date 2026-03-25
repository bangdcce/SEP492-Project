import { Button, Card } from "@/shared/components/ui";

type RequestDraftAlertProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

export function RequestDraftAlert({
  onCancel,
  onConfirm,
}: RequestDraftAlertProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md border-2 border-primary/20 p-6 shadow-2xl">
        <h3 className="mb-2 text-lg font-bold">Switch back to Draft?</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          <strong className="mb-1 block text-orange-600">Warning:</strong>
          Switching to draft will hide your project from the marketplace. Brokers cannot see it,
          and you cannot send new invitations until you post it again.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Confirm & Edit
          </Button>
        </div>
      </Card>
    </div>
  );
}
