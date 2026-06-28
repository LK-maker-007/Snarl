// Manual mock: returns a fixed stored key so loadEncryptionKey() resolves without the native
// Keystore or a CSPRNG in the test runner.
module.exports = {
  getGenericPassword: async () => ({username: 'mmkv', password: 'test-encryption-key'}),
  setGenericPassword: async () => ({service: 'snarl.consentStoreKey'}),
  resetGenericPassword: async () => true,
};
