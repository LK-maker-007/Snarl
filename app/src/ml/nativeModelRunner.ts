import {NativeModules} from 'react-native';
import type {TensorflowModelDelegate} from 'react-native-fast-tflite';
import {ModelRunner} from './trackClip';

// Name of the model file bundled in the app's native assets (android/app/src/main/assets).
const MODEL_ASSET = 'model.tflite';

interface ModelAssetModule {
  resolveModelPath(assetName: string): Promise<string>;
}

// The inference library loads models via java.net.URL, which only resolves real schemes. A bundled
// asset has no filesystem path in a release build (require() yields a scheme-less resource name that
// fails to parse), so a small native module extracts the asset to the cache directory and returns
// its absolute path, which is then handed over as a file:// URL.
function getModelAssetModule(): ModelAssetModule {
  const native = NativeModules.ModelAsset as ModelAssetModule | undefined;
  if (native === undefined) {
    throw new Error('Native ModelAsset module is not available');
  }
  return native;
}

// Adapter from the bundled model asset to the ModelRunner seam. The inference library is a native
// (Nitro) module, so it is required lazily — importing it at module scope would pull native code
// into environments that don't have it (e.g. the jest runner). The model is a research-only weight
// bundled as a gitignored asset.
export async function loadNativeModelRunner(
  delegates: TensorflowModelDelegate[] = [],
): Promise<ModelRunner> {
  const {loadTensorflowModel} =
    require('react-native-fast-tflite') as typeof import('react-native-fast-tflite');
  const path = await getModelAssetModule().resolveModelPath(MODEL_ASSET);
  const model = await loadTensorflowModel({url: `file://${path}`}, delegates);

  return {
    run: async (input: Float32Array): Promise<Float32Array> => {
      const outputs = await model.run([toArrayBuffer(input)]);
      const output = outputs[0];
      if (output === undefined) {
        throw new Error('model returned no output tensor');
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
