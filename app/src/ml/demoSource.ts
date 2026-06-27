import {DEMO_SOURCE} from '../assets/demo/source';
import type {TrackerSource} from '../domain/clip';

// Typed view of the bundled demo clip. The data file is a committed stub (empty frames) that a
// local build replaces with the real footage; an empty `frames` means no demo is available and the
// UI hides the tracker entry.
export const demoSource: TrackerSource = DEMO_SOURCE;
