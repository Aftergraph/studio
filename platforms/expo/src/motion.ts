// Aftergraph Living Interface motion contract.
// Runtime mapping: Reanimated spring / timing on native; semantic names match web + SwiftUI.
export const motionSemantic = {
  'control.press': { duration: 120, spring: { damping: 22, stiffness: 360, mass: .55 } },
  'state.change': { duration: 210, spring: { damping: 24, stiffness: 300, mass: .7 } },
  'trajectory.advance': { duration: 240, spring: { damping: 23, stiffness: 260, mass: .75 } },
  'surface.expand': { duration: 340, spring: { damping: 28, stiffness: 240, mass: .8 } },
  'attention.focus': { duration: 360, spring: { damping: 30, stiffness: 220, mass: .85 } },
  'outcome.settle': { duration: 420, spring: { damping: 32, stiffness: 205, mass: .9 } },
} as const;

export type MotionSemanticName = keyof typeof motionSemantic;
export const motionFor = (name: MotionSemanticName) => motionSemantic[name];
