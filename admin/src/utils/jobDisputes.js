// Mirrors backend job.model.js dispute.resolution enum
// (PATCH /admin/jobs/:id/resolve-dispute in job.controller.js resolveDispute).
export const DISPUTE_RESOLUTIONS = [
  { value: 'DEDUCT_FROM_WORKER', label: 'Deduct proportional fee from worker' },
  { value: 'WAIVE_FEE', label: 'Waive platform fee' },
  { value: 'REFUND_CUSTOMER', label: 'Refund short amount to customer' },
  { value: 'CLOSE', label: 'Close without financial action' },
]
