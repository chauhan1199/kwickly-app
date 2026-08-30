import { describe, it, expect } from 'vitest';
import { isAbortError, extractErrorMessage } from './errorUtils';

describe('isAbortError', () => {
    it('recognizes native AbortController aborts', () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        expect(isAbortError(err)).toBe(true);
    });

    it('recognizes axios cancellation errors', () => {
        expect(isAbortError({ name: 'CanceledError' })).toBe(true);
        expect(isAbortError({ code: 'ERR_CANCELED' })).toBe(true);
    });

    it('does not treat real errors as aborts', () => {
        expect(isAbortError(new Error('Network down'))).toBe(false);
        expect(isAbortError(null)).toBe(false);
        expect(isAbortError(undefined)).toBe(false);
    });
});

describe('extractErrorMessage', () => {
    it('returns the fallback for falsy errors', () => {
        expect(extractErrorMessage(null)).toBe('Operation failed');
        expect(extractErrorMessage(undefined, 'Custom fallback')).toBe('Custom fallback');
    });

    it('joins backend validation error arrays', () => {
        const err = { response: { data: { errors: ['"email" is required', '"phone" is required'] } } };
        expect(extractErrorMessage(err)).toBe('"email" is required • "phone" is required');
    });

    it('prefers backend message over fallback', () => {
        const err = { response: { data: { message: 'Insufficient withdrawable balance' } } };
        expect(extractErrorMessage(err, 'fallback')).toBe('Insufficient withdrawable balance');
    });

    it('uses raw error message when not a request failure', () => {
        expect(extractErrorMessage(new Error('Something local'))).toBe('Something local');
    });

    it('falls back when the only message is a generic axios failure', () => {
        expect(extractErrorMessage(new Error('Request failed with status code 500'), 'Server error')).toBe('Server error');
    });

    it('ignores empty validation arrays', () => {
        const err = { response: { data: { errors: [], message: 'real message' } } };
        expect(extractErrorMessage(err)).toBe('real message');
    });
});
