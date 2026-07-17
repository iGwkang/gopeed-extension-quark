// src/index.js
import { quarkRequest } from './quark/net.js';

// Retain for bundling until resolve wiring lands; unused at runtime.
gopeed.__quarkRequest = quarkRequest;

gopeed.events.onResolve(async () => {
  throw new Error('尚未实现');
});
