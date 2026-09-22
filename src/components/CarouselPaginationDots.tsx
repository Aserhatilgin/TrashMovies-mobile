import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { currentTheme as theme } from '../constants/Colors';

const MAX_VISIBLE_DOTS = 5;
const DOT_STEP = 16;
const DOT_SIZE = 6;
const ACTIVE_SIZE = 9;
const VIEWPORT_HEIGHT = 10;

interface CarouselPaginationDotsProps {
  currentIndex: number;
  total: number;
}

export function CarouselPaginationDots({ currentIndex, total }: CarouselPaginationDotsProps) {
  const count = Math.min(total, MAX_VISIBLE_DOTS);
  const firstIndex = Math.min(Math.max(currentIndex - 2, 0), total - count);
  const previous = useRef({ currentIndex, firstIndex });
  const windowOffset = useRef(new Animated.Value(0)).current;
  const markerOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const { currentIndex: oldIndex, firstIndex: oldFirstIndex } = previous.current;
    if (oldIndex === currentIndex) {
      previous.current = { currentIndex, firstIndex };
      return;
    }

    const windowDirection = Math.sign(firstIndex - oldFirstIndex);
    windowOffset.setValue(windowDirection * DOT_STEP);
    markerOffset.setValue(windowDirection !== 0
      ? windowDirection * DOT_STEP
      : Math.sign(oldIndex - currentIndex) * DOT_STEP);

    const animation = Animated.parallel([
      Animated.timing(windowOffset, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(markerOffset, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]);
    animation.start();
    previous.current = { currentIndex, firstIndex };
    return () => animation.stop();
  }, [currentIndex, firstIndex, markerOffset, windowOffset]);

  return (
    <View pointerEvents="none" style={[styles.viewport, { width: count * DOT_STEP }]}>
      <Animated.View style={[styles.dotWindow, { transform: [{ translateX: windowOffset }] }]}>
        {Array.from({ length: count + 2 }, (_, slot) => {
          const index = firstIndex + slot - 1;
          if (index < 0 || index >= total) return null;
          const isOuter = slot <= 1 && firstIndex > 0
            || slot >= count && firstIndex + count < total;
          const size = isOuter ? 4 : DOT_SIZE;
          return (
            <View
              key={index}
              style={{
                position: 'absolute',
                left: (slot - 1) * DOT_STEP + (DOT_STEP - size) / 2,
                top: (VIEWPORT_HEIGHT - size) / 2,
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: theme.mutedText,
                opacity: isOuter ? 0.55 : 1,
              }}
            />
          );
        })}
      </Animated.View>
      <Animated.View
        style={[
          styles.activeDot,
          {
            left: (currentIndex - firstIndex) * DOT_STEP + (DOT_STEP - ACTIVE_SIZE) / 2,
            backgroundColor: theme.primary,
            transform: [{ translateX: markerOffset }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { height: VIEWPORT_HEIGHT, overflow: 'hidden' },
  dotWindow: { position: 'absolute', left: 0, top: 0, height: VIEWPORT_HEIGHT, width: '100%' },
  activeDot: { position: 'absolute', top: (VIEWPORT_HEIGHT - ACTIVE_SIZE) / 2, width: ACTIVE_SIZE, height: ACTIVE_SIZE, borderRadius: ACTIVE_SIZE / 2 },
});
