module.exports = {
  __esModule: true,
  default: {
    open: jest.fn(() => Promise.resolve({ razorpay_payment_id: 'test' })),
  },
};
