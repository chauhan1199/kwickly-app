import { getSubscriptionState } from '../src/utils/subscription';

const now = new Date('2026-10-13T12:00:00Z');
const days = (n) => new Date(now.getTime() + n * 86400000).toISOString();

describe('getSubscriptionState', () => {
  it('uses the stored trial end, not createdAt + 30', () => {
    const user = { createdAt: days(-60), subscription: { isTrial: true, trialEndDate: days(16), expiryDate: days(16) } };
    const s = getSubscriptionState(user, 14, now);
    expect(s).toMatchObject({ isTrialActive: true, isPaidActive: false, isActive: true, daysLeft: 16 });
  });

  it('treats a paid plan as active and the trial as over', () => {
    const user = { createdAt: days(-60), subscription: { isTrial: false, trialEndDate: days(-30), expiryDate: days(20) } };
    expect(getSubscriptionState(user, 14, now)).toMatchObject({ isTrialActive: false, isPaidActive: true, daysLeft: 20 });
  });

  it('is expired when both have ended', () => {
    const user = { createdAt: days(-60), subscription: { isTrial: true, trialEndDate: days(-1), expiryDate: days(-1) } };
    expect(getSubscriptionState(user, 14, now).isActive).toBe(false);
  });

  it('falls back to createdAt + freeTrialDays when no trial end is stored', () => {
    expect(getSubscriptionState({ createdAt: days(-10) }, 14, now)).toMatchObject({ isTrialActive: true, daysLeft: 4 });
  });

  it('is inactive while the profile has not loaded', () => {
    expect(getSubscriptionState(null, 14, now).isActive).toBe(false);
  });
});
