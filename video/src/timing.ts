/** Frames per second of every composition. */
export const FPS = 30;

/** A duration in seconds as a whole number of frames at FPS. */
export const seconds = (s: number): number => Math.round(s * FPS);
