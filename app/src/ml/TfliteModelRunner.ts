import type {TensorflowModelDelegate} from 'react-native-fast-tflite';
import {ModelRunner} from './trackClip';

// Adapter from the bundled TFLite model to the ModelRunner seam. react-native-fast-tflite is a
// native (Nitro) module, so it is required lazily — importing it at module scope would pull native
// code into environments that don't have it (e.g. the jest runner). The model is a research-only
// weight bundled as a gitignored asset; metro resolves the require at build time.
export async function loadTfliteRunner(
  delegates: TensorflowModelDelegate[] = [],
): Promise<ModelRunner> {
  const {loadTensorflowModel} =
    require('react-native-fast-tflite') as typeof import('react-native-fast-tflite');
  const model = await loadTensorflowModel(require('../assets/demo/model.tflite'), delegates);

  return {
    run: async (input: Float32Array): Promise<Float32Array> => {
      const outputs = await model.run([toArrayBuffer(input)]);
      const output = outputs[0];
      if (output === undefined) {
        throw new Error('TFLite model returned no output tensor');
      }
      return new Float32Array(output);
    },
  };
}

// buildInputTensor allocates a fresh, fully-backed Float32Array, so its backing buffer is exactly
// the tensor bytes with no offset — safe to hand to the model without copying.
function toArrayBuffer(view: Float32Array): ArrayBuffer {
  return view.buffer as ArrayBuffer;
}
