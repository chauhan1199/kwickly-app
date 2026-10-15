// Display rules for a job's live status, shared by the customer and worker home screens.

const WORKER_CURRENT_JOB_STATUSES = ['ALLOCATED', 'ARRIVING', 'IN_PROGRESS', 'COMPLETED'];
const WORKER_CURRENT_JOB_HINT = {
  ALLOCATED: 'HIRED · Go to customer and enter arrival OTP',
  ARRIVING: 'ON THE WAY · Enter arrival OTP at the door',
  IN_PROGRESS: 'IN PROGRESS · Finish and mark complete',
  COMPLETED: 'DONE · Waiting for customer payment'
};

/** The worker's "current job" card: hired and not yet paid. */
export const isWorkerCurrentJob = (job) =>
  !!job && WORKER_CURRENT_JOB_STATUSES.includes(job.status) && job.payment?.status !== 'PAID';

export const workerCurrentJobHint = (job) => {
  if (job?.status === 'COMPLETED' && job.payment?.status === 'PENDING_VERIFICATION') {
    return 'DONE · Payment under verification';
  }
  return WORKER_CURRENT_JOB_HINT[job?.status] || '';
};

/** Status pill on the customer's active-job card. */
export const activeJobPillLabel = (job) => {
  switch (job?.status) {
    case 'BROADCASTING': return '📡 LIVE RADAR';
    case 'QUOTES_RECEIVED': return '💬 QUOTES';
    case 'ALLOCATED': return 'HIRED';
    case 'ARRIVING': return 'ON THE WAY';
    case 'IN_PROGRESS': return '⚡ IN PROGRESS';
    case 'COMPLETED': return job.payment?.status === 'PENDING_VERIFICATION' ? 'VERIFYING' : 'PAY NOW';
    default: return 'ACTIVE';
  }
};
