// Manual mock: an in-memory MMKV so the test runner never loads the native module. Mirrors the
// subset the app uses (set / getString).
function createMMKV() {
  const map = new Map();
  return {
    set: (key, value) => {
      map.set(key, value);
    },
    getString: key => map.get(key),
    remove: key => map.delete(key),
    contains: key => map.has(key),
    getAllKeys: () => [...map.keys()],
    clearAll: () => map.clear(),
  };
}

module.exports = {createMMKV};
