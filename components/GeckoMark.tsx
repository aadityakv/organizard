// Organizard gecko logomark — single-color, eye punched via mask
// so it reads on any background. Ported from assets/gecko-mark.svg.
import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, Mask, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

export function GeckoMark({ size = 40, color = colors.brand }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" fill="none">
      <Defs>
        <Mask id="geckoeye">
          <Rect x="0" y="0" width="240" height="240" fill="white" />
          <Circle cx="120" cy="52" r="7" fill="black" />
        </Mask>
      </Defs>
      <G mask="url(#geckoeye)" fill={color} stroke={color} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M104 92 Q80 84 64 66" fill="none" strokeWidth={15} />
        <Path d="M136 92 Q160 84 176 66" fill="none" strokeWidth={15} />
        <Path d="M104 150 Q80 160 66 180" fill="none" strokeWidth={15} />
        <Path d="M136 150 Q160 160 174 180" fill="none" strokeWidth={15} />
        <Circle cx="62" cy="62" r="13" />
        <Circle cx="178" cy="62" r="13" />
        <Circle cx="64" cy="184" r="13" />
        <Circle cx="176" cy="184" r="13" />
        <Path d="M120 168 C122 196 150 210 176 200 C202 190 204 162 186 154 C172 148 160 158 164 170" fill="none" strokeWidth={17} />
        <Ellipse cx="120" cy="58" rx={30} ry={31} />
        <Ellipse cx="120" cy="124" rx={29} ry={52} />
      </G>
    </Svg>
  );
}
