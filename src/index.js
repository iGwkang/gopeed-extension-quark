import { handleResolve } from './quark/resolve.js';
import { handleStart } from './quark/start.js';

gopeed.events.onResolve(async (ctx) => {
  await handleResolve(ctx);
});

gopeed.events.onStart(async (ctx) => {
  await handleStart(ctx);
});