// Tuck logomark — a sleepy sloth tucked into a green moving box.
// Multi-color brand mark; ported 1:1 from the design system's sloth-mark.svg
// (the same art as the app icon, minus the rose tile, so it sits on app surfaces).
import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

export function SlothMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {/* arms tucked over the box edge */}
      <G fill="#A77E54">
        <Path d="M39 66 c-2 -7 4 -10 9.5 -8 c4.5 1.6 5.5 6.5 2 9.8 c-3.4 3.2 -9.5 3 -11.5 -1.8 Z" />
        <Path d="M81 66 c2 -7 -4 -10 -9.5 -8 c-4.5 1.6 -5.5 6.5 -2 9.8 c3.4 3.2 9.5 3 11.5 -1.8 Z" />
      </G>
      {/* claws */}
      <G stroke="#7A5636" strokeWidth={1.5} strokeLinecap="round">
        <Path d="M42 60 v3.4" />
        <Path d="M46.5 59 v3.6" />
        <Path d="M78 60 v3.4" />
        <Path d="M73.5 59 v3.6" />
      </G>
      {/* head */}
      <Ellipse cx={60} cy={41} rx={20.5} ry={19} fill="#A77E54" />
      {/* face */}
      <Ellipse cx={60} cy={44} rx={15.5} ry={14.5} fill="#F0E0C6" />
      {/* eye patches */}
      <Ellipse cx={51.5} cy={42} rx={5.4} ry={8} fill="#6E4A30" rotation={20} originX={51.5} originY={42} />
      <Ellipse cx={68.5} cy={42} rx={5.4} ry={8} fill="#6E4A30" rotation={-20} originX={68.5} originY={42} />
      {/* eyes + highlights */}
      <Circle cx={52} cy={43} r={2.5} fill="#2A2722" />
      <Circle cx={68} cy={43} r={2.5} fill="#2A2722" />
      <Circle cx={52.9} cy={42.1} r={0.9} fill="#FFFFFF" />
      <Circle cx={68.9} cy={42.1} r={0.9} fill="#FFFFFF" />
      {/* nose + smile */}
      <Ellipse cx={60} cy={49.5} rx={2.8} ry={2.1} fill="#2A2722" />
      <Path d="M55.5 53.5 q4.5 3.4 9 0" fill="none" stroke="#7A5636" strokeWidth={1.9} strokeLinecap="round" />
      {/* green moving box (drawn last — sloth peeks over it) */}
      <Rect x={24} y={63} width={72} height={42} rx={11} fill="#4CAF7D" />
      <Path d="M25 64 L57 64 L50.5 49.5 L18 49.5 Z" fill="#62BC8C" />
      <Path d="M95 64 L63 64 L69.5 49.5 L102 49.5 Z" fill="#3C9669" />
      <Rect x={55} y={63} width={10} height={42} fill="#E0F1E7" opacity={0.9} />
    </Svg>
  );
}
