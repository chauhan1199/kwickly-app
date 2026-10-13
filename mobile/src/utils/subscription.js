// Worker plan state, mirroring the backend's go-online check (worker.controller toggleOnline):
// trial = subscription.trialEndDate (or createdAt + freeTrialDays) while isTrial !== false,
// paid  = subscription.expiryDate in the future and not just the trial end copied into it.
const DAY = 86400000;

export const getSubscriptionState = (user, freeTrialDays = 14, now = new Date()) => {
  if (!user) {
    return { isTrialActive: false, isPaidActive: false, isActive: false, trialDaysLeft: 0, paidDaysLeft: 0, daysLeft: 0 };
  }
  const sub = user?.subscription || {};
  const created = user?.createdAt ? new Date(user.createdAt) : now;
  const trialEnd = sub.trialEndDate ? new Date(sub.trialEndDate) : new Date(created.getTime() + freeTrialDays * DAY);
  const expiry = sub.expiryDate ? new Date(sub.expiryDate) : null;

  const isTrialActive = sub.isTrial !== false && trialEnd > now;
  // Signup stores expiryDate = trialEndDate, so only count it as a paid plan when it is not the trial end
  const isPaidActive = !!expiry && expiry > now && (sub.isTrial === false || Math.abs(expiry - trialEnd) > DAY);

  const trialDaysLeft = isTrialActive ? Math.ceil((trialEnd - now) / DAY) : 0;
  const paidDaysLeft = isPaidActive ? Math.ceil((expiry - now) / DAY) : 0;

  return {
    isTrialActive,
    isPaidActive,
    isActive: isTrialActive || isPaidActive,
    trialDaysLeft,
    paidDaysLeft,
    daysLeft: isPaidActive ? paidDaysLeft : trialDaysLeft,
  };
};
