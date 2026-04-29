'use client';

import { useEffect } from 'react';
import * as THREE from 'three';

export default function ThreeShim() {
  useEffect(() => {
    try {
      // If THREE.Timer exists and a legacy THREE.Clock is missing, alias Clock to Timer
      // This can silence deprecation warnings coming from third-party libs that still
      // instantiate `new THREE.Clock()` while the environment prefers `THREE.Timer`.
      // It's a non-destructive runtime alias.
      if ((THREE as any).Timer && !(THREE as any).Clock) {
        (THREE as any).Clock = (THREE as any).Timer;
      }
    } catch (e) {
      // ignore
    }
  }, []);

  return null;
}
