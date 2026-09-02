import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  FlatList,
  Alert,
} from 'react-native';
import { useAppContext } from '@/context';
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useColorScheme } from '@/hooks/useColorScheme';
import API from '@/api';
import { Colors, getAccentIconColor, getMutedIconColor, getOnAccentTextColor } from '@/constants/Colors';
import ReservationFormSection, { ReservationFieldInput } from './Partials/ReservationFormSection';
import ReservationPickerSheet from './Partials/ReservationPickerSheet';
import ReservationSuccessModal from './Partials/ReservationSuccessModal';
import { format } from 'date-fns';
import * as CalendarAPI from 'expo-calendar';
import { Ionicons } from '@expo/vector-icons';
import Skeleton from '@/components/ui/Skeleton';

export default function NewReservation({ selectedDate: propSelectedDate, prefillTime, onClose, placeId: propPlaceId }) {
  const { user, token } = useAppContext();
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // Get placeId and selectedDate from route params or props (props take priority)
  const routePlaceId = propPlaceId || params.placeId;
  const routeSelectedDate = params.selectedDate || propSelectedDate;
  
  const [step, setStep] = useState(1);
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
      setStudio(String(routePlaceId));
    }
  }, [routePlaceId]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [studio, setStudio] = useState('');
  const [places, setPlaces] = useState([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [equipment, setEquipment] = useState([]);
  const [selectedEquipment, setSelectedEquipment] = useState([]);
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const [day, setDay] = useState(routeSelectedDate || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);

  useEffect(() => {
    if (!token) return;
    if (places.length === 0) {
      setLoadingPlaces(true);
      API.getWithAuth('places', token)
        .then(res => setPlaces(res.data?.studios || []))
        .catch(err => console.error('Places fetch error', err))
        .finally(() => setLoadingPlaces(false));
    }
    if (step === 2 && users.length === 0) {
      setLoadingUsers(true);
      API.getWithAuth('users', token)
        .then(res => setUsers(res.data || []))
        .catch(err => console.error('Users fetch error', err))
        .finally(() => setLoadingUsers(false));
    }
    if (step === 3 && equipment.length === 0) {
      setLoadingEquipment(true);
      API.getWithAuth('equipment', token)
        .then(res => setEquipment(res.data || []))
        .catch(err => console.error('Equipment fetch error', err))
        .finally(() => setLoadingEquipment(false));
    }
  }, [step, token]);

  const toggleUser = (id) =>
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleEquipment = (id) =>
    setSelectedEquipment(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const nextStep = () => setStep(s => Math.min(s + 1, 3));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const submitReservation = async () => {
    if (!token) return;
    if (!name || !name.trim()) {
      Alert.alert('Validation Error', 'Please enter a reservation name');
      return;
    }
    if (!studio) {
      Alert.alert('Validation Error', 'Please select a studio');
      return;
    }
    if (!day) {
      Alert.alert('Validation Error', 'Please select a date');
      return;
    }
    if (!startTime || !endTime) {
      Alert.alert('Validation Error', 'Please select start and end times');
      return;
    }

    const payload = {
      title: name.trim(),
      description: description?.trim() || '',
      studio_id: studio,
      day: day,
      start: startTime.toTimeString().slice(0, 5),
      end: endTime.toTimeString().slice(0, 5),
      user_id: user.id,
      team_members: selectedUsers,
      equipment: selectedEquipment,
    };

    try {
      const response = await API.postWithAuth('reservations/store', payload, token);
      setCreatedReservation({
        title: `Studio Reservation - ${name}`,
        description,
        day: day,
        start: startTime.toTimeString().slice(0, 5),
        end: endTime.toTimeString().slice(0, 5),
        location: places.find(p => p.id === studio)?.name || 'Studio',
        ...(response.data?.reservation || {}),
      });
      setShowModal(true);
    } catch (error) {
      console.error('Error creating reservation:', error);
    }
  };

  const handleCancel = () => {
    if (onClose) {
      onClose();
    } else {
      prevStep();
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
        title: createdReservation.title || 'Reservation',
        startDate: startDateTime,
        endDate: endDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: createdReservation.location || '',
        notes: createdReservation.description || '',
        alarms: [{ relativeOffset: -15, method: CalendarAPI.AlarmMethod.ALERT }],
      };
      const eventId = await CalendarAPI.createEventAsync(calendarId, event);
      Alert.alert('✅ Added', 'Event added to your calendar successfully!');
    } catch (err) {
      console.error('Add to calendar error:', err);
      Alert.alert('Error', 'Failed to add to calendar.');
    }
  };

  const onAccentText = getOnAccentTextColor(isDark);
  const accentIcon = getAccentIconColor(isDark);
  const mutedIcon = getMutedIconColor(isDark);

  return (
    <View className="flex-1 bg-light dark:bg-dark">
      <View className="px-4 pt-4 pb-3 border-b border-beta/8 dark:border-light/8 bg-light dark:bg-dark">
        <View className="flex-row items-center justify-between mb-3">
          <Pressable
            onPress={step > 1 ? prevStep : handleCancel}
            className="w-10 h-10 rounded-xl items-center justify-center active:opacity-70"
          >
            <Ionicons name={step > 1 ? 'arrow-back' : 'close'} size={22} color={isDark ? Colors.light : Colors.beta} />
          </Pressable>

          <View className="items-center flex-1 px-2">
            <Text className="text-xs font-semibold uppercase tracking-wide text-beta/45 dark:text-light/45">
              Reservations
            </Text>
            <Text className="text-base font-bold text-beta dark:text-light">New reservation</Text>
            <Text className="text-xs text-beta/55 dark:text-light/55 mt-0.5">Step {step} of 3</Text>
          </View>

          <Pressable
            onPress={step === 3 ? submitReservation : nextStep}
            disabled={step === 3 && (!name || !studio || !day)}
            className={`min-w-[72px] h-10 px-4 rounded-xl items-center justify-center ${
              step === 3 && (!name || !studio || !day)
                ? 'bg-beta/10 dark:bg-light/10'
                : 'bg-beta dark:bg-alpha active:opacity-80'
            }`}
          >
            <Text
              className={`text-sm font-bold ${
                step === 3 && (!name || !studio || !day)
                  ? 'text-beta/35 dark:text-light/35'
                  : 'text-light dark:text-beta'
              }`}
            >
              {step === 3 ? 'Submit' : 'Next'}
            </Text>
          </Pressable>
        </View>

        <View className="flex-row items-center justify-center gap-2">
          {[1, 2, 3].map((n) => (
            <View key={n} className="flex-row items-center">
              <View
                className={`h-2 rounded-full ${step >= n ? 'w-8 bg-beta dark:bg-alpha' : 'w-2 bg-beta/20 dark:bg-light/20'}`}
              />
              {n < 3 ? (
                <View className={`w-3 h-0.5 ${step > n ? 'bg-beta dark:bg-alpha' : 'bg-beta/15 dark:bg-light/15'}`} />
              ) : null}
            </View>
          ))}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 pb-10 gap-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <>
            <ReservationFormSection icon="create-outline" title="Reservation name">
              <ReservationFieldInput
                value={name}
                onChangeText={setName}
                placeholder="Enter reservation name..."
                placeholderTextColor={mutedIcon}
              />
            </ReservationFormSection>

            <ReservationFormSection icon="document-text-outline" title="Description">
              <ReservationFieldInput
                value={description}
                onChangeText={setDescription}
                placeholder="Add a description (optional)..."
                placeholderTextColor={mutedIcon}
                multiline
                numberOfLines={4}
                className="min-h-[100px] py-3"
                style={{ textAlignVertical: 'top' }}
              />
            </ReservationFormSection>

            {!routePlaceId && (
              <ReservationFormSection icon="business-outline" title="Select studio">
                {loadingPlaces ? (
                  <Skeleton width={26} height={26} borderRadius={13} isDark={isDark} />
                ) : (
                  <FlatList
                    data={places}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerClassName="gap-3 px-0.5"
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => {
                      const isSelected = String(studio) === String(item.id);
                      return (
                        <Pressable
                          onPress={() => setStudio(String(item.id))}
                          className={`w-[140px] rounded-2xl overflow-hidden border ${
                            isSelected
                              ? 'border-beta dark:border-alpha bg-beta/5 dark:bg-alpha/10'
                              : 'border-beta/10 dark:border-light/10 bg-light dark:bg-dark'
                          } active:opacity-80`}
                        >
                          {item.image ? (
                            <Image source={{ uri: item.image }} className="w-full h-[100px]" resizeMode="cover" />
                          ) : (
                            <View className="w-full h-[100px] bg-beta/10 dark:bg-light/10 items-center justify-center">
                              <Ionicons name="business" size={40} color={accentIcon} />
                            </View>
                          )}
                          <View className="p-3">
                            <Text
                              className={`text-sm text-center font-semibold ${
                                isSelected ? 'text-beta dark:text-alpha' : 'text-beta dark:text-light'
                              }`}
                            >
                              {item.name}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    }}
                  />
                )}
              </ReservationFormSection>
            )}

            {routePlaceId && studio ? (
              <View className="rounded-2xl border border-dashed border-beta/30 dark:border-alpha/40 bg-beta/5 dark:bg-alpha/10 p-4">
                <View className="flex-row items-center gap-4">
                  <View className="w-12 h-12 rounded-xl bg-beta/15 dark:bg-alpha/20 items-center justify-center">
                    <Ionicons name="checkmark-circle" size={28} color={accentIcon} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold uppercase tracking-wide text-beta/50 dark:text-light/50 mb-1">
                      Selected studio
                    </Text>
                    <Text className="text-lg font-bold text-beta dark:text-light">
                      {places.find((p) => String(p.id) === String(studio))?.name || 'Selected Studio'}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

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
          </>
        )}

        {step === 2 && (
          <ReservationFormSection icon="people-outline" title="Select team members">
            {loadingUsers ? (
              <Skeleton width={26} height={26} borderRadius={13} isDark={isDark} />
            ) : (
              users.map((userItem) => {
                const hasCustomImage = userItem.image && !userItem.image.includes('pdp.png');
                const initials = userItem.name
                  ? userItem.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                  : '?';
                const isSelected = selectedUsers.includes(userItem.id);

                return (
                  <Pressable
                    key={userItem.id}
                    onPress={() => toggleUser(userItem.id)}
                    className={`flex-row items-center justify-between p-4 mb-3 rounded-xl border active:opacity-80 ${
                      isSelected
                        ? 'border-beta dark:border-alpha bg-beta/5 dark:bg-alpha/10'
                        : 'border-beta/10 dark:border-light/10 bg-light dark:bg-dark'
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      {hasCustomImage ? (
                        <Image
                          source={{
                            uri: userItem.image.startsWith('http')
                              ? userItem.image
                              : `${API.APP_URL}/${userItem.image}`,
                          }}
                          className="w-12 h-12 rounded-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="w-12 h-12 rounded-full bg-beta/10 dark:bg-alpha/15 items-center justify-center">
                          <Text className="text-base font-bold text-beta dark:text-alpha">{initials}</Text>
                        </View>
                      )}
                      <Text className="text-base font-semibold text-beta dark:text-light">
                        {userItem.name || userItem.username}
                      </Text>
                    </View>
                    <View
                      className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                        isSelected
                          ? 'border-beta dark:border-alpha bg-beta dark:bg-alpha'
                          : 'border-beta/30 dark:border-light/30'
                      }`}
                    >
                      {isSelected ? <Ionicons name="checkmark" size={14} color={onAccentText} /> : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ReservationFormSection>
        )}

        {step === 3 && (
          <ReservationFormSection icon="hardware-chip-outline" title="Select equipment">
            {loadingEquipment ? (
              <Skeleton width={26} height={26} borderRadius={13} isDark={isDark} />
            ) : (
              equipment.map((item) => {
                const isSelected = selectedEquipment.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleEquipment(item.id)}
                    className={`flex-row items-center justify-between p-4 mb-3 rounded-xl border active:opacity-80 ${
                      isSelected
                        ? 'border-beta dark:border-alpha bg-beta/5 dark:bg-alpha/10'
                        : 'border-beta/10 dark:border-light/10 bg-light dark:bg-dark'
                    }`}
                  >
                    <View className="flex-row items-center gap-3 flex-1">
                      {item.image ? (
                        <Image source={{ uri: item.image }} className="w-12 h-12 rounded-xl" resizeMode="cover" />
                      ) : (
                        <View className="w-12 h-12 rounded-xl bg-beta/10 dark:bg-alpha/15 items-center justify-center">
                          <Ionicons name="cube-outline" size={24} color={accentIcon} />
                        </View>
                      )}
                      <Text className="text-base font-semibold text-beta dark:text-light flex-1">{item.mark}</Text>
                    </View>
                    <View
                      className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                        isSelected
                          ? 'border-beta dark:border-alpha bg-beta dark:bg-alpha'
                          : 'border-beta/30 dark:border-light/30'
                      }`}
                    >
                      {isSelected ? <Ionicons name="checkmark" size={14} color={onAccentText} /> : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ReservationFormSection>
        )}
      </ScrollView>

      <ReservationSuccessModal
        visible={showModal}
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
