/**
 * Tests for the keep-alive self-pinger (helpers/keepAlive.helper.js)
 *
 * http/https are spied on, so no request ever leaves the test process.
 */

jest.mock('../helpers/logger.helper', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

const https = require('https');
const http = require('http');
const { startKeepAlive, stopKeepAlive } = require('../helpers/keepAlive.helper');

const TWELVE_MIN = 12 * 60 * 1000;

// Minimal stand-in for the ClientRequest returned by http(s).get
const fakeRequest = () => ({
    on: jest.fn(),
    setTimeout: jest.fn(),
    destroy: jest.fn()
});

describe('Keep-alive self-pinger', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        jest.useFakeTimers();
        process.env = { ...ORIGINAL_ENV };
        delete process.env.KEEP_ALIVE_URL;
        delete process.env.RENDER_EXTERNAL_URL;
    });

    afterEach(() => {
        stopKeepAlive();
        jest.useRealTimers();
        jest.restoreAllMocks();
        process.env = ORIGINAL_ENV;
    });

    it('does not start outside production', () => {
        process.env.NODE_ENV = 'development';
        process.env.RENDER_EXTERNAL_URL = 'https://example.com';
        const spy = jest.spyOn(https, 'get').mockImplementation(fakeRequest);

        expect(startKeepAlive()).toBe(false);
        jest.advanceTimersByTime(TWELVE_MIN * 3);
        expect(spy).not.toHaveBeenCalled();
    });

    it('does not start when no public URL is known', () => {
        process.env.NODE_ENV = 'production';
        const spy = jest.spyOn(https, 'get').mockImplementation(fakeRequest);

        expect(startKeepAlive()).toBe(false);
        jest.advanceTimersByTime(TWELVE_MIN * 3);
        expect(spy).not.toHaveBeenCalled();
    });

    it('pings <url>/health every 12 minutes in production', () => {
        process.env.NODE_ENV = 'production';
        process.env.RENDER_EXTERNAL_URL = 'https://kwickly.example.com/';
        const spy = jest.spyOn(https, 'get').mockImplementation(fakeRequest);

        expect(startKeepAlive()).toBe(true);
        expect(spy).not.toHaveBeenCalled(); // nothing until the first interval

        jest.advanceTimersByTime(TWELVE_MIN);
        expect(spy).toHaveBeenCalledWith('https://kwickly.example.com/health', expect.any(Function));

        jest.advanceTimersByTime(TWELVE_MIN * 2);
        expect(spy).toHaveBeenCalledTimes(3);
    });

    it('prefers KEEP_ALIVE_URL over the host-injected URL', () => {
        process.env.NODE_ENV = 'production';
        process.env.RENDER_EXTERNAL_URL = 'https://host-injected.example.com';
        process.env.KEEP_ALIVE_URL = 'https://explicit.example.com';
        const spy = jest.spyOn(https, 'get').mockImplementation(fakeRequest);

        startKeepAlive();
        jest.advanceTimersByTime(TWELVE_MIN);

        expect(spy).toHaveBeenCalledWith('https://explicit.example.com/health', expect.any(Function));
    });

    it('uses the http module for an http:// url', () => {
        process.env.NODE_ENV = 'production';
        process.env.KEEP_ALIVE_URL = 'http://insecure.example.com';
        const httpsSpy = jest.spyOn(https, 'get').mockImplementation(fakeRequest);
        const httpSpy = jest.spyOn(http, 'get').mockImplementation(fakeRequest);

        startKeepAlive();
        jest.advanceTimersByTime(TWELVE_MIN);

        expect(httpSpy).toHaveBeenCalledWith('http://insecure.example.com/health', expect.any(Function));
        expect(httpsSpy).not.toHaveBeenCalled();
    });

    it('drains the response so the socket is released', () => {
        process.env.NODE_ENV = 'production';
        process.env.KEEP_ALIVE_URL = 'https://kwickly.example.com';
        const res = { statusCode: 200, resume: jest.fn() };
        jest.spyOn(https, 'get').mockImplementation((url, cb) => {
            cb(res);
            return fakeRequest();
        });

        startKeepAlive();
        jest.advanceTimersByTime(TWELVE_MIN);

        expect(res.resume).toHaveBeenCalled();
    });

    it('swallows request errors instead of crashing the process', () => {
        process.env.NODE_ENV = 'production';
        process.env.KEEP_ALIVE_URL = 'https://kwickly.example.com';
        const req = fakeRequest();
        jest.spyOn(https, 'get').mockImplementation(() => req);

        startKeepAlive();
        jest.advanceTimersByTime(TWELVE_MIN);

        const errorHandler = req.on.mock.calls.find(([event]) => event === 'error')?.[1];
        expect(typeof errorHandler).toBe('function');
        expect(() => errorHandler(new Error('ECONNRESET'))).not.toThrow();
    });

    it('destroys a request that exceeds the ping timeout', () => {
        process.env.NODE_ENV = 'production';
        process.env.KEEP_ALIVE_URL = 'https://kwickly.example.com';
        const req = fakeRequest();
        jest.spyOn(https, 'get').mockImplementation(() => req);

        startKeepAlive();
        jest.advanceTimersByTime(TWELVE_MIN);

        const [ms, onTimeout] = req.setTimeout.mock.calls[0];
        expect(ms).toBe(20000);
        onTimeout();
        expect(req.destroy).toHaveBeenCalled();
    });

    it('stopKeepAlive halts further pings', () => {
        process.env.NODE_ENV = 'production';
        process.env.KEEP_ALIVE_URL = 'https://kwickly.example.com';
        const spy = jest.spyOn(https, 'get').mockImplementation(fakeRequest);

        startKeepAlive();
        jest.advanceTimersByTime(TWELVE_MIN);
        expect(spy).toHaveBeenCalledTimes(1);

        stopKeepAlive();
        jest.advanceTimersByTime(TWELVE_MIN * 5);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('a second start does not double up the interval', () => {
        process.env.NODE_ENV = 'production';
        process.env.KEEP_ALIVE_URL = 'https://kwickly.example.com';
        const spy = jest.spyOn(https, 'get').mockImplementation(fakeRequest);

        startKeepAlive();
        startKeepAlive();
        jest.advanceTimersByTime(TWELVE_MIN);

        expect(spy).toHaveBeenCalledTimes(1);
    });
});
