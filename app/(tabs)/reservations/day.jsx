import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, RefreshControl, Modal } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '@/components/layout/AppLayout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppContext } from '@/context';
import API from '@/api';
import { Colors, getAccentFillColor, Overlays } from '@/constants/Colors';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import NewReservation from './reserve';
import NewCoworkReservation from './reserveCowork';
import Skeleton from '@/components/ui/Skeleton';
import ReservationDetailHeader from './Partials/ReservationDetailHeader';
import TimelineSlotSelector from './Partials/TimelineSlotSelector';
import {
  TIMELINE_END_MINUTES,
  TIMELINE_HOUR_HEIGHT,
  TIMELINE_START_MINUTES,
  clamp,
  getTimelineTotalHeight,
  minutesToY,
  selectionToTimeRange,
} from './Partials/timelineUtils';

export default function DayView() {
  const { date, tab, reservations: reservationsParam, reservationsCowork: reservationsCoworkParam, place: placeParam } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { token } = useAppContext();
  const isDark = colorScheme === 'dark';
  const accentFill = getAccentFillColor(isDark);

  // Parse place from params
  const selectedPlace = useMemo(() => {
    if (!placeParam) return null;
    try {
      return typeof placeParam === 'string' ? JSON.parse(placeParam) : placeParam;
    } catch (e) {
      console.error('[DAY VIEW] Error parsing place:', e);
      return null;
    }
  }, [placeParam]);

  // ---- Parse received reservations ----
  const [reservations, setReservations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [day, setDay] = useState(
    typeof date === 'string' && date.length >= 10
      ? date
      : new Date().toISOString().split('T')[0]
  );

  // ---- Date helpers - Use exact reservation date and time ----
  const toDateOnlyFromSpace = (datetime) => {
    if (!datetime) return '';
    const parts = String(datetime).split(' ');
    return parts[0] || '';
  };
  
  // Get exact reservation date - prioritize day field (actual reservation date)
  const getReservationDate = (r) => {
    // First try the actual reservation day field
    if (r?.day) {
      // If day is already in YYYY-MM-DD format, return it
      if (typeof r.day === 'string' && r.day.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return r.day;
      }
      // If day is a date string, extract YYYY-MM-DD
      const dayDate = new Date(r.day);
      if (!isNaN(dayDate.getTime())) {
        return format(dayDate, 'yyyy-MM-dd');
      }
    }
    // Fallback to date field
    if (r?.date) {
      if (typeof r.date === 'string' && r.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return r.date;
      }
      const dateDate = new Date(r.date);
      if (!isNaN(dateDate.getTime())) {
        return format(dateDate, 'yyyy-MM-dd');
      }
    }
    // Last resort: use created_at (but this should be avoided)
    return toDateOnlyFromSpace(r?.created_at);
  };

  // ---- UI states ----
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(day));
  const [showNewReservation, setShowNewReservation] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState(null);
  const [timelineScrollEnabled, setTimelineScrollEnabled] = useState(true);

  // Update day when date param changes
  useEffect(() => {
    if (date && typeof date === 'string' && date.length >= 10) {
      setDay(date);
      setCurrentMonthDate(new Date(date));
    }
  }, [date]);

  // Optimized parsing - parse reservations from params
  useEffect(() => {
    setIsLoading(true);
    try {
      let parsed = null;
      if (reservationsParam) {
        parsed = typeof reservationsParam === 'string' ? JSON.parse(reservationsParam) : reservationsParam;
      } else if (reservationsCoworkParam) {
        parsed = typeof reservationsCoworkParam === 'string' ? JSON.parse(reservationsCoworkParam) : reservationsCoworkParam;
      }
      if (parsed) {
        setReservations(Array.isArray(parsed) ? parsed : []);
      }
      // Small delay to show loading state
      setTimeout(() => setIsLoading(false), 300);
    } catch (e) {
      console.warn('Error parsing reservations param', e);
      setReservations([]);
      setIsLoading(false);
    }
  }, [reservationsParam, reservationsCoworkParam]);

  // ---- Helpers - Exact time parsing ----
  const toDateTimeFromDateAndTime = (dateStr, timeStr) => {
    if (!dateStr) return '';
    // Parse time exactly as provided, ensuring proper format
    if (!timeStr) return `${dateStr} 00:00`;
    
    const timeStrClean = String(timeStr).trim();
    // Handle various time formats: "HH:MM", "HH:MM:SS", etc.
    const timeMatch = timeStrClean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (timeMatch) {
      const h = String(parseInt(timeMatch[1], 10)).padStart(2, '0');
      const m = String(parseInt(timeMatch[2], 10)).padStart(2, '0');
      return `${dateStr} ${h}:${m}`;
    }
    // Fallback to original logic
    const [h = '00', m = '00'] = timeStrClean.split(':');
    return `${dateStr} ${String(parseInt(h, 10) || 0).padStart(2, '0')}:${String(parseInt(m, 10) || 0).padStart(2, '0')}`;
  };

  // ---- Events ----
  const events = useMemo(() => {
    return reservations
      .filter((r) => getReservationDate(r) === day)
      .map((r) => ({
        id: r.id,
        start: toDateTimeFromDateAndTime(day, r.start),
        end: toDateTimeFromDateAndTime(day, r.end || r.start),
        title: r.title || 'Reservation',
        summary: r.location || '',
        type: r.type,
        color: r.canceled ? Colors.dark_gray : Colors.alpha,
        rawStart: r.start,
        rawEnd: r.end || r.start,
        canceled: !!r.canceled,
      }));
  }, [reservations, day, isDark]);

  const HOUR_HEIGHT = TIMELINE_HOUR_HEIGHT;
  const START_MINUTES = TIMELINE_START_MINUTES;
  const END_MINUTES = TIMELINE_END_MINUTES;
  const TOTAL_HEIGHT = getTimelineTotalHeight(HOUR_HEIGHT, START_MINUTES, END_MINUTES);

  // Parse time exactly - ensure precise time matching
  const parseHm = (hm) => {
    if (!hm) return START_MINUTES;
    const timeStr = String(hm).trim();
    // Handle exact time format: "HH:MM" or "H:MM"
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const h = parseInt(timeMatch[1], 10) || 0;
      const m = parseInt(timeMatch[2], 10) || 0;
      return h * 60 + m;
    }
    // Fallback
    const [h = '0', m = '0'] = timeStr.split(':');
    return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
  };
  const clampMinutes = (v, min, max) => clamp(v, min, max);
  const toY = useCallback((minutes) => minutesToY(minutes, HOUR_HEIGHT, START_MINUTES), [HOUR_HEIGHT, START_MINUTES]);

  // Position events and detect overlaps for side-by-side display
  const positioned = useMemo(() => {
    return events.map((e) => {
      const s = clampMinutes(parseHm(e.rawStart), START_MINUTES, END_MINUTES);
      const en = clampMinutes(parseHm(e.rawEnd), START_MINUTES, END_MINUTES);
      const top = toY(s);
      const height = Math.max(36, toY(en) - toY(s));
      return { ...e, top, height, startMin: s, endMin: en };
    });
  }, [events]);

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonthDate);
    const end = endOfMonth(currentMonthDate);
    return eachDayOfInterval({ start, end });
  }, [currentMonthDate]);

  const timelineScrollRef = useRef(null);
  const dateSelectorScrollRef = useRef(null);

  // Auto-scroll date selector to show selected day
  useEffect(() => {
    if (dateSelectorScrollRef.current && day && daysInMonth.length > 0) {
      const selectedDate = new Date(day);
      const selectedDayNum = selectedDate.getDate();
      
      // Find the index of the selected day in the current month
      const dayIndex = daysInMonth.findIndex(d => d.getDate() === selectedDayNum);
      
      if (dayIndex >= 0) {
        const dayWidth = 40; // width of each day button
        const gap = 8; // gap between days
        const scrollPosition = Math.max(0, (dayIndex * (dayWidth + gap)) - 150); // Offset to center the day
        
        setTimeout(() => {
          dateSelectorScrollRef.current?.scrollTo({ 
            x: scrollPosition, 
            animated: true 
          });
        }, 150);
      }
    }
  }, [day, daysInMonth]);

  // Auto-scroll to show all reservations (from earliest to latest)
  useEffect(() => {
    if (positioned.length > 0 && timelineScrollRef.current) {
      const earliestStart = Math.min(...positioned.map(e => e.startMin));

      // Calculate scroll position to show all reservations
      const startY = Math.max(0, toY(earliestStart) - 100); // Offset by 100px to show context above

      // Scroll to show the earliest reservation
      setTimeout(() => {
        timelineScrollRef.current?.scrollTo({ y: startY, animated: true });
      }, 200);
    } else if (timelineScrollRef.current) {
      // Default to 7:30 if no reservations
      const defaultY = toY(7 * 60 + 30);
      setTimeout(() => {
        timelineScrollRef.current?.scrollTo({ y: defaultY, animated: true });
      }, 200);
    }
  }, [positioned, toY, day]);

  // ---- Fetch reservations from API ----
  const fetchReservations = useCallback(async () => {
    if (!token) return;
    try {
      if (tab === 'cowork') {
        const response = await API.getWithAuth('mobile/reservationsCowork', token);
        if (response?.data) {
          const data = response.data.reservations || [];
          setReservations(Array.isArray(data) ? data : []);
        }
      } else {
        const response = await API.getWithAuth('mobile/reservations', token);
        if (response?.data) {
          const data = response.data.reservations || [];
          setReservations(Array.isArray(data) ? data : []);
        }
      }
    } catch (error) {
      console.error('[DAY VIEW] Fetch Error:', error);
      // Keep existing reservations on error
    }
  }, [token, tab]);

  // ---- Refresh ----
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReservations();
    setRefreshing(false);
  }, [fetchReservations]);

  const clearSlotSelection = useCallback(() => {
    setSelectedTimeRange(null);
  }, []);

  useEffect(() => {
    clearSlotSelection();
    setShowNewReservation(false);
  }, [day, clearSlotSelection]);

  const handleSlotSelected = useCallback((selection) => {
    setSelectedTimeRange(selectionToTimeRange(selection));
    setShowNewReservation(true);
  }, []);

  // Optimized navigation data
  const navigationData = useMemo(() => JSON.stringify(reservations), [reservations]);

  // ---- Navigation handler (optimized) ----
  const goToDayView = useCallback((dayObj) => {
    if (tab === 'studios') {
      router.push({
        pathname: '/reservations/day',
        params: { date: dayObj.dateString, tab, reservations: navigationData },
      });
    } else {
      router.push({
        pathname: '/reservations/day',
        params: { date: dayObj.dateString, tab, reservationsCowork: navigationData },
      });
    }
  }, [tab, navigationData, router]);

  // Show loading state while parsing reservations
  if (isLoading) {
    return (
      <AppLayout>
        <View className="flex-1 justify-center items-center bg-light dark:bg-dark">
          <Skeleton width={26} height={26} borderRadius={13} isDark={isDark} />
          <View className="h-3.5" />
          <Skeleton width={220} height={14} borderRadius={12} isDark={isDark} />
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <View className="flex-1 bg-light dark:bg-dark">
      <ReservationDetailHeader
        title={format(new Date(day), 'EEE, d MMM yyyy')}
        subtitle={selectedPlace?.name || 'Day schedule'}
        rightAction={{
          label: 'Add',
          icon: 'add',
          onPress: () => {
            clearSlotSelection();
            setShowNewReservation(true);
          },
        }}
      />

      {/* ===== Date Selector ===== */}
      <View className="px-4 pt-3 pb-3 border-b border-beta/8 dark:border-light/8 bg-light dark:bg-dark">
        {/* Weekday Labels */}
        <View className="flex-row justify-between mb-2 px-1">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <View key={i} className="items-center flex-1">
              <Text className="text-[11px] font-semibold text-beta/60 dark:text-light/60">{d}</Text>
            </View>
          ))}
        </View>

        <ScrollView
          ref={dateSelectorScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-1"
        >
          {daysInMonth.map((dateObj) => {
            const num = dateObj.getDate();
            const dateString = format(dateObj, 'yyyy-MM-dd');
            const isSelected = dateString === day;
            const isToday = dateString === format(new Date(), 'yyyy-MM-dd');
            const hasReservations = reservations.some((r) => getReservationDate(r) === dateString);

            return (
              <Pressable
                key={dateString}
                onPress={() => {
                  setDay(dateString);
                  setCurrentMonthDate(new Date(dateString));
                  if (tab) {
                    goToDayView({ dateString });
                  }
                }}
                className={`w-11 h-11 rounded-full items-center justify-center active:opacity-80 ${
                  isSelected ? 'bg-beta dark:bg-alpha' : isToday ? 'border-2 border-beta dark:border-alpha' : ''
                }`}
              >
                <Text
                  className={`text-[15px] ${
                    isSelected
                      ? 'font-extrabold text-light dark:text-beta'
                      : isToday
                        ? 'font-bold text-beta dark:text-light'
                        : 'font-semibold text-beta dark:text-light'
                  }`}
                >
                  {num}
                </Text>
                {hasReservations && !isSelected ? (
                  <View className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-beta dark:bg-alpha" />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Full Date Display */}
        {/* <View style={{ marginTop: 16, marginBottom: 12 }}>
          <Text style={{ 
            fontSize: 14, 
            fontWeight: '600',
            color: isDark ? '#fafafa' : '#212529',
            marginBottom: 4
          }}>
            {format(new Date(day), 'EEE - d MMM yyyy')}
          </Text>
        </View> */}
      </View>

      {/* ===== Timeline Scroll ===== */}
      <View className="flex-1 bg-light dark:bg-dark">
        <ScrollView
          ref={timelineScrollRef}
          scrollEnabled={timelineScrollEnabled}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentFill} colors={[accentFill]} />}
          showsVerticalScrollIndicator
          contentContainerStyle={{
            minHeight: TOTAL_HEIGHT + 48,
            paddingBottom: 16,
          }}
        >
          <View style={{ height: TOTAL_HEIGHT, flexDirection: 'row', minHeight: TOTAL_HEIGHT }}>
            <View style={{ width: 60, paddingRight: 8, paddingLeft: 8 }}>
              {Array.from({ length: Math.ceil(END_MINUTES / 60) - Math.floor(START_MINUTES / 60) + 1 }).map((_, idx) => {
                const hr = Math.floor(START_MINUTES / 60) + idx;
                const top = toY(hr * 60);
                return (
                  <View key={hr} style={{ position: 'absolute', top: top - 10, height: 20, width: '100%', alignItems: 'flex-end' }}>
                    <Text className="text-xs font-medium text-beta/60 dark:text-light/60">
                      {String(hr).padStart(2, '0')}:00
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={{ flex: 1, position: 'relative' }}>
              <TimelineSlotSelector
                occupiedSlots={positioned}
                leftInset={52}
                onDragStateChange={setTimelineScrollEnabled}
                onSelectionComplete={handleSlotSelected}
                onClearSelection={clearSlotSelection}
              />

              {Array.from({ length: Math.ceil(END_MINUTES / 60) - Math.floor(START_MINUTES / 60) + 1 }).map((_, idx) => {
                const hr = Math.floor(START_MINUTES / 60) + idx;
                const top = toY(hr * 60);
                return (
                  <View
                    key={hr}
                    pointerEvents="none"
                    className="absolute right-0 border-t border-beta/10 dark:border-light/10"
                    style={{ top, left: 52, height: 1 }}
                  />
                );
              })}

              {positioned.map((e, i) => {
                const stripeColor = e.canceled
                  ? (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)')
                  : accentFill;

                return (
                  <Pressable
                    key={e.id || i}
                    onPress={() => e.id && router.push({ pathname: '/reservations/[id]', params: { id: e.id } })}
                    style={{
                      position: 'absolute',
                      top: e.top,
                      left: 52,
                      right: 12,
                      height: Math.max(e.height, 36),
                      flexDirection: 'row',
                      alignItems: 'center',
                      zIndex: 2,
                    }}
                  >
                    <View
                      className="absolute inset-0 rounded-xl border border-beta/10 dark:border-light/10 bg-white dark:bg-card"
                      style={{ opacity: e.canceled ? 0.55 : 1, zIndex: -1 }}
                    />
                    <View style={{ width: 4, height: '100%', backgroundColor: stripeColor, borderRadius: 2 }} />
                    <View className="flex-1 ml-3 py-1.5 pr-2">
                      <Text className="text-sm font-bold text-beta dark:text-light" numberOfLines={2}>
                        {e.title}
                      </Text>
                      <Text className="text-xs font-semibold text-beta/55 dark:text-light/55 mt-1" numberOfLines={1}>
                        {e.rawStart} - {e.rawEnd}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View className="px-4 py-2 border-t border-beta/8 dark:border-light/8 bg-light dark:bg-dark">
          <Text className="text-[11px] text-beta/45 dark:text-light/45 text-center">
            Long press an empty slot, drag to adjust the time, then release to book
          </Text>
        </View>
      </View>

      {showNewReservation ? (
        <Modal
          visible={showNewReservation}
          animationType="slide"
          transparent
          onRequestClose={() => {
            setShowNewReservation(false);
            clearSlotSelection();
          }}
        >
          <View className="flex-1 justify-end" style={{ backgroundColor: Overlays.modalScrim }}>
            <View className="flex-1 max-h-[92%] bg-light dark:bg-dark rounded-t-3xl overflow-hidden border-t border-beta/10 dark:border-light/10">
              {tab === 'cowork' ? (
                <NewCoworkReservation
                  selectedDate={day}
                  prefillTime={selectedTimeRange}
                  onClose={() => {
                    setShowNewReservation(false);
                    clearSlotSelection();
                  }}
                  placeId={selectedPlace?.id === 'cowork-all' ? undefined : selectedPlace?.id}
                />
              ) : (
                <NewReservation
                  selectedDate={day}
                  prefillTime={selectedTimeRange}
                  onClose={() => {
                    setShowNewReservation(false);
                    clearSlotSelection();
                  }}
                  placeId={selectedPlace?.id}
                />
              )}
            </View>
          </View>
        </Modal>
      ) : null}
      </View>
    </AppLayout>
  );
}
