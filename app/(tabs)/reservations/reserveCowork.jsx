import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { useAppContext } from '@/context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import API from '@/api';
import { Colors, getAccentIconColor, getMutedIconColor, getOnAccentTextColor } from '@/constants/Colors';
import { format } from 'date-fns';
import * as CalendarAPI from 'expo-calendar';
import { Ionicons } from '@expo/vector-icons';
import Skeleton from '@/components/ui/Skeleton';
import ReservationFormSection, { ReservationFieldInput } from './Partials/ReservationFormSection';
import ReservationPickerSheet from './Partials/ReservationPickerSheet';
import ReservationSuccessModal from './Partials/ReservationSuccessModal';

export default function NewCoworkReservation({ selectedDate: propSelectedDate, prefillTime, onClose }) {
  const { user, token } = useAppContext();
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const routePlaceId = params.placeId;
  const routeSelectedDate = params.selectedDate || propSelectedDate;

  const [table, setTable] = useState(routePlaceId || '');
  const [seats, setSeats] = useState('');
  const [day, setDay] = useState(routeSelectedDate || format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [createdReservation, setCreatedReservation] = useState(null);

  useEffect(() => {
    if (prefillTime) {
      const toDate = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        const d = new Date();
        d.setHours(h);
        d.setMinutes(m);
        d.setSeconds(0);
        d.setMilliseconds(0);
        return d;
      };
      setStartTime(toDate(prefillTime.start));
      setEndTime(toDate(prefillTime.end));
    }
  }, [prefillTime]);

  useEffect(() => {
    if (routeSelectedDate) {
      setDay(routeSelectedDate);
    }
  }, [routeSelectedDate]);

  useEffect(() => {
    if (routePlaceId) {
      setTable(routePlaceId);
    }
  }, [routePlaceId]);

  useEffect(() => {
    if (!token) return;
    setLoadingTables(true);
    API.getWithAuth('places', token)
      .then(res => {
        const placesData = res.data || {};
        const tablesData = placesData.coworks;
        setTables(Array.isArray(tablesData) ? tablesData : []);
      })
      .catch(err => {
        console.error('Tables fetch error', err);
        Alert.alert('Error', 'Failed to load tables. Please try again.');
      })
      .finally(() => setLoadingTables(false));
  }, [token]);

  const validateForm = () => {
    if (!table) {
      Alert.alert('Validation Error', 'Please select a table');
      return false;
    }
    if (!seats || parseInt(seats) < 1) {
      Alert.alert('Validation Error', 'Please enter at least 1 seat');
      return false;
    }
    if (!day) {
      Alert.alert('Validation Error', 'Please select a date');
      return false;
    }
    if (!startTime || !endTime) {
      Alert.alert('Validation Error', 'Please select start and end times');
      return false;
    }
    if (startTime >= endTime) {
      Alert.alert('Validation Error', 'End time must be after start time');
      return false;
    }
    return true;
  };

  const submitReservation = async () => {
    if (!validateForm()) return;
    if (!token) return;

    setSubmitting(true);
    const payload = {
      table: parseInt(table),
      seats: parseInt(seats),
      day: day,
      start: format(startTime, 'HH:mm'),
      end: format(endTime, 'HH:mm'),
    };

    try {
      const response = await API.postWithAuth('cowork/reserve', payload, token);
      const selectedTable = tables.find(t => t.id === parseInt(table));
      setCreatedReservation({
        title: `Cowork Reservation - ${selectedTable?.name || `Table ${table}`}`,
        day: day,
        start: format(startTime, 'HH:mm'),
        end: format(endTime, 'HH:mm'),
        location: selectedTable?.name || `Table ${table}`,
        seats: seats,
        ...(response.data?.reservation || {}),
      });
      setShowModal(true);
    } catch (error) {
      console.error('Error creating cowork reservation:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'Failed to create reservation. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onClose) {
      onClose();
    }
  };

  const ensureCalendarExists = async () => {
    const { status } = await CalendarAPI.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant calendar access to add events.');
      return null;
    }
    const calendars = await CalendarAPI.getCalendarsAsync(CalendarAPI.EntityTypes.EVENT);
    const modifiable = calendars.filter((cal) => cal.allowsModifications);
    if (modifiable.length === 0) {
      Alert.alert('No Calendar', 'No modifiable calendar found.');
      return null;
    }
    const defaultCalendar = modifiable.find(cal =>
      cal.isPrimary ||
      cal.source?.type === 'local' ||
      cal.source?.title?.toLowerCase().includes('default')
    ) || modifiable[0];
    return defaultCalendar.id;
  };

  const addToDeviceCalendar = async () => {
    if (!createdReservation) return;
    try {
      const calendarId = await ensureCalendarExists();
      if (!calendarId) return;
      const startDateTime = new Date(`${createdReservation.day} ${createdReservation.start}`);
      const endDateTime = new Date(`${createdReservation.day} ${createdReservation.end}`);
      const event = {
        title: createdReservation.title || 'Cowork Reservation',
        startDate: startDateTime,
        endDate: endDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: createdReservation.location || '',
        notes: `Seats: ${createdReservation.seats || 'N/A'}`,
        alarms: [{ relativeOffset: -15, method: CalendarAPI.AlarmMethod.ALERT }],
      };
      const eventId = await CalendarAPI.createEventAsync(calendarId, event);
      Alert.alert('✅ Added', 'Event added to your calendar successfully!');
    } catch (err) {
      console.error('Add to calendar error:', err);
      Alert.alert('Error', 'Failed to add to calendar.');
    }
  };

  const accentIcon = getAccentIconColor(isDark);
  const mutedIcon = getMutedIconColor(isDark);

  return (
    <View className="flex-1 bg-light dark:bg-dark">
      <View className="px-4 pt-4 pb-3 border-b border-beta/8 dark:border-light/8 bg-light dark:bg-dark">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={handleCancel}
            className="w-10 h-10 rounded-xl items-center justify-center active:opacity-70"
          >
            <Ionicons name="close" size={22} color={isDark ? Colors.light : Colors.beta} />
          </Pressable>

          <View className="items-center flex-1 px-2">
            <Text className="text-xs font-semibold uppercase tracking-wide text-beta/45 dark:text-light/45">
              Reservations
            </Text>
            <Text className="text-base font-bold text-beta dark:text-light">Cowork reservation</Text>
          </View>

          <Pressable
            onPress={submitReservation}
            disabled={submitting || !table || !seats || !day}
            className={`min-w-[72px] h-10 px-4 rounded-xl items-center justify-center ${
              submitting || !table || !seats || !day
                ? 'bg-beta/10 dark:bg-light/10'
                : 'bg-beta dark:bg-alpha active:opacity-80'
            }`}
          >
            {submitting ? (
              <Skeleton width={16} height={16} borderRadius={8} isDark={isDark} />
            ) : (
              <Text
                className={`text-sm font-bold ${
                  submitting || !table || !seats || !day
                    ? 'text-beta/35 dark:text-light/35'
                    : 'text-light dark:text-beta'
                }`}
              >
                Submit
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 pb-10 gap-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ReservationFormSection icon="grid-outline" title="Select table *">
          {loadingTables ? (
            <Skeleton width={26} height={26} borderRadius={13} isDark={isDark} />
          ) : tables.length === 0 ? (
            <View className="py-6 items-center">
              <Ionicons name="alert-circle-outline" size={32} color={mutedIcon} />
              <Text className="text-sm text-beta/60 dark:text-light/60 mt-2">No tables available</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
              {tables.map((tbl) => {
                const isSelected = table === tbl.id?.toString() || table === tbl.id;
                return (
                  <Pressable
                    key={tbl.id}
                    onPress={() => setTable(tbl.id?.toString() || tbl.id)}
                    className={`min-w-[120px] px-6 py-4 rounded-2xl border items-center active:opacity-80 ${
                      isSelected
                        ? 'border-beta dark:border-alpha bg-beta/5 dark:bg-alpha/10'
                        : 'border-beta/10 dark:border-light/10 bg-light dark:bg-dark'
                    }`}
                  >
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={isSelected ? accentIcon : mutedIcon}
                      style={{ marginBottom: 8 }}
                    />
                    <Text
                      className={`text-base font-semibold ${
                        isSelected ? 'text-beta dark:text-alpha' : 'text-beta dark:text-light'
                      }`}
                    >
                      {tbl.name || `Table ${tbl.id}`}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </ReservationFormSection>

        <ReservationFormSection icon="people-outline" title="Number of seats *">
          <ReservationFieldInput
            value={seats}
            onChangeText={(text) => setSeats(text.replace(/[^0-9]/g, ''))}
            placeholder="Enter number of seats..."
            placeholderTextColor={mutedIcon}
            keyboardType="number-pad"
            className="text-center text-lg font-semibold"
          />
        </ReservationFormSection>

        <ReservationFormSection icon="calendar-outline" title="Date & time">
          <Pressable
            onPress={() => setShowDayPicker(true)}
            className={`flex-row items-center rounded-xl border p-4 mb-3 active:opacity-80 ${
              showDayPicker
                ? 'border-beta dark:border-alpha bg-beta/5 dark:bg-alpha/10'
                : 'border-beta/10 dark:border-light/10 bg-light dark:bg-dark'
            }`}
          >
            <View className="w-12 h-12 rounded-xl bg-beta/10 dark:bg-alpha/15 items-center justify-center mr-4">
              <Ionicons name="calendar" size={24} color={accentIcon} />
            </View>
            <View className="flex-1">
              {day ? (
                <>
                  <Text className="text-base font-bold text-beta dark:text-light mb-0.5">
                    {format(new Date(day), 'EEEE')}
                  </Text>
                  <Text className="text-sm text-beta/60 dark:text-light/60">
                    {format(new Date(day), 'MMMM d, yyyy')}
                  </Text>
                </>
              ) : (
                <Text className="text-base font-semibold text-beta/60 dark:text-light/60">Select date</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={mutedIcon} />
          </Pressable>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setShowStartPicker(true)}
              className={`flex-1 rounded-xl border p-4 items-center active:opacity-80 ${
                showStartPicker
                  ? 'border-beta dark:border-alpha bg-beta/5 dark:bg-alpha/10'
                  : 'border-beta/10 dark:border-light/10 bg-light dark:bg-dark'
              }`}
            >
              <Ionicons name="time-outline" size={24} color={accentIcon} style={{ marginBottom: 8 }} />
              <Text className="text-sm font-semibold text-beta/60 dark:text-light/60 mb-1">Start</Text>
              <Text className="text-lg font-bold text-beta dark:text-light tracking-wide">
                {startTime ? format(startTime, 'HH:mm') : '--:--'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowEndPicker(true)}
              className={`flex-1 rounded-xl border p-4 items-center active:opacity-80 ${
                showEndPicker
                  ? 'border-beta dark:border-alpha bg-beta/5 dark:bg-alpha/10'
                  : 'border-beta/10 dark:border-light/10 bg-light dark:bg-dark'
              }`}
            >
              <Ionicons name="time" size={24} color={accentIcon} style={{ marginBottom: 8 }} />
              <Text className="text-sm font-semibold text-beta/60 dark:text-light/60 mb-1">End</Text>
              <Text className="text-lg font-bold text-beta dark:text-light tracking-wide">
                {endTime ? format(endTime, 'HH:mm') : '--:--'}
              </Text>
            </Pressable>
          </View>
        </ReservationFormSection>
      </ScrollView>

      <ReservationSuccessModal
        visible={showModal}
        message="Cowork reservation created successfully"
        onAddToCalendar={addToDeviceCalendar}
        onClose={() => {
          setShowModal(false);
          if (onClose) onClose();
        }}
      />

      <ReservationPickerSheet
        visible={showDayPicker}
        title="Select date"
        onClose={() => setShowDayPicker(false)}
        onDone={() => setShowDayPicker(false)}
        pickerProps={{
          value: new Date(day || new Date()),
          mode: 'date',
          display: 'spinner',
          minimumDate: new Date(),
          onChange: (event, selected) => {
            if (event.type === 'set' && selected) {
              setDay(format(selected, 'yyyy-MM-dd'));
            }
            if (event.type === 'dismissed') {
              setShowDayPicker(false);
            }
          },
        }}
      />

      <ReservationPickerSheet
        visible={showStartPicker}
        title="Select start time"
        onClose={() => setShowStartPicker(false)}
        onDone={() => setShowStartPicker(false)}
        pickerProps={{
          value: startTime,
          mode: 'time',
          is24Hour: true,
          display: 'spinner',
          onChange: (event, selected) => {
            if (event.type === 'set' && selected) {
              setStartTime(selected);
            }
            if (event.type === 'dismissed') {
              setShowStartPicker(false);
            }
          },
        }}
      />

      <ReservationPickerSheet
        visible={showEndPicker}
        title="Select end time"
        onClose={() => setShowEndPicker(false)}
        onDone={() => setShowEndPicker(false)}
        pickerProps={{
          value: endTime,
          mode: 'time',
          is24Hour: true,
          display: 'spinner',
          onChange: (event, selected) => {
            if (event.type === 'set' && selected) {
              setEndTime(selected);
            }
            if (event.type === 'dismissed') {
              setShowEndPicker(false);
            }
          },
        }}
      />
    </View>
  );
}
