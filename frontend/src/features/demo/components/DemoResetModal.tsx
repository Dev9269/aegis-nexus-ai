import { RotateCcw } from "lucide-react";
import { Button, Callout, KeyValue, Modal } from "../../../components/ui";

export function DemoResetModal({
  open,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reset demo environment?"
      description="This restores seeded identities, devices, policies, and removes demo access/incident data."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={loading} onClick={onConfirm}>
            <RotateCcw size={13} /> Reset demo data
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Callout tone="warning" title="Audit history is preserved">
          The reset itself is audited. This is intentional: evidence must survive demo housekeeping.
        </Callout>
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-line/65 bg-raised/30 p-3 text-[11px] text-muted">
          <KeyValue label="Affected scope" value="Demo identities, devices, requests, incidents" />
          <KeyValue label="Preserved" value="Audit ledger, model artifact, real data" />
        </div>
      </div>
    </Modal>
  );
}
