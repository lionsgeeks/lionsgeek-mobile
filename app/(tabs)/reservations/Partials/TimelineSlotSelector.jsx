import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  TIMELINE_END_MINUTES,
  TIMELINE_MIN_DURATION,
  TIMELINE_START_MINUTES,
  buildSelectionRange,
  clamp,
  getTimelineTotalHeight,
  minutesToTimeString,
  minutesToY,
  yToMinutes,
} from './timelineUtils';

const LONG_PRESS_MS = 400;

function SelectionBlock({ selection, conflicting, adjusting, leftInset }) {
  if (!selection) return null;

  const top = minutesToY(selection.startMin);
  const height = Math.max(
    minutesToY(selection.endMin) - minutesToY(selection.startMin),
    minutesToY(TIMELINE_MIN_DURATION),
  );

  return (
    <View
      pointerEvents="none"
      className={`absolute right-3 rounded-xl border-2 ${
        conflicting
          ? 'border-error bg-error/15'
          : 'border-beta dark:border-alpha bg-beta/20 dark:bg-alpha/25'
      }`}
      style={{ top, left: leftInset, height, zIndex: 4 }}
    >
      <View className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-beta dark:bg-alpha" />

      {adjusting ? (
        <>
          <View className="absolute -top-1 left-4 right-4 h-3 rounded-full bg-beta/30 dark:bg-alpha/40 border border-beta dark:border-alpha" />
          <View className="absolute -bottom-1 left-4 right-4 h-3 rounded-full bg-beta/30 dark:bg-alpha/40 border border-beta dark:border-alpha" />
        </>
      ) : null}

      <View className="flex-1 px-3 py-2 justify-center ml-2">
        <Text className={`text-xs font-bold ${conflicting ? 'text-error' : 'text-beta dark:text-light'}`}>
          {minutesToTimeString(selection.startMin)} – {minutesToTimeString(selection.endMin)}
        </Text>
        {conflicting ? (
          <Text className="text-[10px] font-semibold text-error mt-0.5">Slot unavailable</Text>
        ) : adjusting ? (
          <Text className="text-[10px] font-medium text-beta/55 dark:text-light/55 mt-0.5">
            Drag to adjust · Release to book
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function TimelineSlotSelector({
  occupiedSlots = [],
  leftInset = 52,
  onDragStateChange,
  onSelectionComplete,
  onClearSelection,
}) {
  const totalHeight = getTimelineTotalHeight();
  const anchorMinRef = useRef(null);
  const draftRef = useRef(null);
  const isActiveRef = useRef(false);
  const [draftSelection, setDraftSelection] = useState(null);
  const [isAdjusting, setIsAdjusting] = useState(false);

  const isConflicting = useCallback(
    (range) => {
      if (!range) return false;
      return occupiedSlots.some(
        (slot) =>
          !slot.canceled &&
          range.startMin < slot.endMin &&
          range.endMin > slot.startMin,
      );
    },
    [occupiedSlots],
  );

  const conflicting = isConflicting(draftSelection);

  const setDraft = useCallback((next) => {
    draftRef.current = next;
    setDraftSelection(next);
  }, []);

  const resetGesture = useCallback(() => {
    isActiveRef.current = false;
    anchorMinRef.current = null;
    draftRef.current = null;
    setIsAdjusting(false);
    setDraftSelection(null);
    onDragStateChange?.(false);
  }, [onDragStateChange]);

  const handleLongPressActivated = useCallback(
    (y) => {
      onClearSelection?.();
      isActiveRef.current = true;
      anchorMinRef.current = yToMinutes(y, totalHeight);

      const endMin = clamp(
        anchorMinRef.current + TIMELINE_MIN_DURATION,
        TIMELINE_START_MINUTES + TIMELINE_MIN_DURATION,
        TIMELINE_END_MINUTES,
      );
      const startMin = endMin - TIMELINE_MIN_DURATION;

      setIsAdjusting(true);
      onDragStateChange?.(true);
      setDraft({ startMin, endMin });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    },
    [onClearSelection, onDragStateChange, setDraft, totalHeight],
  );

  const handleDragUpdate = useCallback(
    (y) => {
      if (!isActiveRef.current || anchorMinRef.current == null) return;
      const currentMin = yToMinutes(y, totalHeight);
      setDraft(buildSelectionRange(anchorMinRef.current, currentMin));
    },
    [setDraft, totalHeight],
  );

  const handleFingerRelease = useCallback(() => {
    if (!isActiveRef.current) return;

    const finalSelection = draftRef.current;
    resetGesture();

    if (!finalSelection || isConflicting(finalSelection)) {
      onClearSelection?.();
      if (finalSelection && isConflicting(finalSelection)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onSelectionComplete?.(finalSelection);
  }, [isConflicting, onClearSelection, onSelectionComplete, resetGesture]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(LONG_PRESS_MS)
        .failOffsetX([-28, 28])
        .onStart((event) => {
          runOnJS(handleLongPressActivated)(event.y);
        })
        .onUpdate((event) => {
          runOnJS(handleDragUpdate)(event.y);
        })
        .onEnd(() => {
          runOnJS(handleFingerRelease)();
        })
        .onFinalize((_, success) => {
          if (!success) {
            runOnJS(resetGesture)();
          }
        }),
    [handleDragUpdate, handleFingerRelease, handleLongPressActivated, resetGesture],
  );

  const halfHourLines = useMemo(() => {
    const lines = [];
    for (let min = TIMELINE_START_MINUTES; min <= TIMELINE_END_MINUTES; min += 30) {
      if (min % 60 === 0) continue;
      lines.push(min);
    }
    return lines;
  }, []);

  return (
    <>
      {halfHourLines.map((min) => (
        <View
          key={`half-${min}`}
          pointerEvents="none"
          className="absolute right-0 border-t border-dashed border-beta/8 dark:border-light/8"
          style={{
            top: minutesToY(min),
            left: leftInset,
            height: 1,
            zIndex: 0,
          }}
        />
      ))}

      <SelectionBlock
        selection={draftSelection}
        conflicting={conflicting}
        adjusting={isAdjusting}
        leftInset={leftInset}
      />

      <GestureDetector gesture={panGesture}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: leftInset,
            right: 0,
            height: totalHeight,
            zIndex: 1,
          }}
        />
      </GestureDetector>
    </>
  );
}
