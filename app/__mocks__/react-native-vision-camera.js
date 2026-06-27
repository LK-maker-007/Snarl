// Manual mock for the native camera library so the jest runner never loads native code. The
// capture screen is exercised on-device, not in unit tests; these stubs only let the module import.
const Camera = () => null;
const CommonResolutions = {HD_16_9: {width: 720, height: 1280}};
const useCameraDevice = () => undefined;
const useCameraPermission = () => ({hasPermission: false, requestPermission: async () => false});
const useVideoOutput = () => ({
  createRecorder: async () => ({
    startRecording: async () => {},
    stopRecording: async () => {},
  }),
});

module.exports = {Camera, CommonResolutions, useCameraDevice, useCameraPermission, useVideoOutput};
