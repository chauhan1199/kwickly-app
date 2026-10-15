import { isWorkerCurrentJob, workerCurrentJobHint, activeJobPillLabel } from '../src/utils/jobStatus';

describe('jobStatus display rules', () => {
  it('drops a paid job from the worker current-job card', () => {
    expect(isWorkerCurrentJob({ status: 'COMPLETED', payment: { status: 'PENDING' } })).toBe(true);
    expect(isWorkerCurrentJob({ status: 'COMPLETED', payment: { status: 'PAID' } })).toBe(false);
    expect(isWorkerCurrentJob({ status: 'PAID', payment: { status: 'PAID' } })).toBe(false);
    expect(isWorkerCurrentJob({ status: 'ALLOCATED' })).toBe(true);
    expect(isWorkerCurrentJob(null)).toBe(false);
  });

  it('tells the worker when a UPI payment is under verification', () => {
    expect(workerCurrentJobHint({ status: 'COMPLETED', payment: { status: 'PENDING_VERIFICATION' } })).toMatch(/verification/);
    expect(workerCurrentJobHint({ status: 'COMPLETED', payment: { status: 'PENDING' } })).toMatch(/Waiting for customer payment/);
  });

  it('labels the customer pill by the real stage', () => {
    expect(activeJobPillLabel({ status: 'ALLOCATED' })).toBe('HIRED');
    expect(activeJobPillLabel({ status: 'ARRIVING' })).toBe('ON THE WAY');
    expect(activeJobPillLabel({ status: 'IN_PROGRESS' })).toMatch(/IN PROGRESS/);
    expect(activeJobPillLabel({ status: 'COMPLETED', payment: { status: 'PENDING' } })).toBe('PAY NOW');
    expect(activeJobPillLabel({ status: 'COMPLETED', payment: { status: 'PENDING_VERIFICATION' } })).toBe('VERIFYING');
  });
});
