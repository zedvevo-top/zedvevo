import React from 'react';
import PlanRenewalDialog from '@/components/common/PlanRenewalDialog';

interface UploadPlanExpiredModalProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onRenewSuccess?: () => void;
}

export default function UploadPlanExpiredModal({ open, onOpenChange, onRenewSuccess }: UploadPlanExpiredModalProps) {
  return (
    <PlanRenewalDialog
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onRenewSuccess}
    />
  );
}

