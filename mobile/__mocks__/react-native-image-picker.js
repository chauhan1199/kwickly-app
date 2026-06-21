module.exports = {
  launchImageLibrary: jest.fn(() => Promise.resolve({ didCancel: false, assets: [] })),
  launchCamera: jest.fn(() => Promise.resolve({ didCancel: false, assets: [] })),
};
