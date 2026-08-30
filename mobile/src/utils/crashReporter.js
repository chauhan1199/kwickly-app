/**
 * Lightweight global crash/error capture.
 *
 * Sentry (@sentry/react-native) is NOT wired up here on purpose: adding it
 * requires native build changes (auto-linking + new native code), which would
 * invalidate the existing APK build. If/when the project owner is ready to
 * rebuild the APK, install @sentry/react-native and replace this module's
 * internals — init with an env DSN (must be a no-op when the DSN is unset)
 * and call Sentry.setUser() from setCrashUserContext().
 *
 * Until then, this module installs a JS-level global error handler that:
 *  - preserves the default RN fatal-error reporting behaviour, and
 *  - logs structured error info (with user context, when available) via
 *    the app console, which ends up in device logs / bug reports.
 */

let userContext = null;

/**
 * Attach user context for error reports. Safe to call before init.
 */
export const setCrashUserContext = (userId, role) => {
  userContext = userId || role ? { userId: userId || null, role: role || null } : null;
};

export const getCrashUserContext = () => userContext;

const formatError = (error, isFatal) => {
  const ctx = userContext ? ` user={id:${userContext.userId},role:${userContext.role}}` : '';
  return `[CrashReporter]${isFatal ? ' [FATAL]' : ''}${ctx} ${error?.stack || error?.message || String(error)}`;
};

/**
 * Install the global JS error handler. No-op when ErrorUtils is unavailable
 * (e.g. tests / non-RN environments).
 */
export const initCrashReporting = () => {
  if (typeof ErrorUtils === 'undefined' || typeof ErrorUtils.setGlobalHandler !== 'function') {
    return false;
  }
  const previousHandler = ErrorUtils.getGlobalHandler && ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      // eslint-disable-next-line no-console
      console.error(formatError(error, isFatal));
    } catch (_) {
      // Never let the reporter itself crash the app.
    }
    if (typeof previousHandler === 'function') {
      previousHandler(error, isFatal);
    }
  });
  return true;
};

export default { initCrashReporting, setCrashUserContext, getCrashUserContext };
