import { useState } from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ExperienceFormModal from '../_components/ExperienceFormModal';
import { formatPeriod, formatPeriodFromParts, calcDuration, calcDurationFromParts } from './_helpers';

export default function ExperienceCard({ profile, isDark, isOwnProfile, token, onExperienceAdded, onExperienceUpdated, onExperienceDeleted }) {
  const rawList =
    profile?.experiences ??
    profile?.experience ??
    profile?.user_experiences ??
    profile?.userExperiences ??
    [];
  const list = Array.isArray(rawList) ? rawList.filter(Boolean) : [];

  const MAX_DESC_CHARS = 140;
  const [expandedByKey, setExpandedByKey] = useState({});
  const [formModal, setFormModal] = useState({ visible: false, experience: null });

  const toggleExpanded = (key) => {
    setExpandedByKey((prev) => ({ ...prev, [key]: !prev?.[key] }));
  };

  const openAdd = () => setFormModal({ visible: true, experience: null });
  const openEdit = (exp) => setFormModal({ visible: true, experience: exp });
  const closeForm = () => setFormModal({ visible: false, experience: null });

  return (
    <>
      <View className="mx-4 mb-3 rounded-2xl bg-light dark:bg-dark border border-black/10 dark:border-white/10 overflow-hidden">
        {/* ── Section header ── */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-3 border-b border-black/5 dark:border-dark_gray">
          <View className="flex-row items-center gap-2">
            <View className="w-7 h-7 rounded-lg bg-alpha/15 items-center justify-center">
              <Ionicons name="briefcase" size={14} color="#ffc801" />
            </View>
            <Text className="text-base font-bold text-black dark:text-white">Experience</Text>
          </View>
          <View className="flex-row items-center gap-2">
            {list.length > 0 && (
              <View className="px-2 py-0.5 rounded-full bg-alpha/10">
                <Text className="text-xs font-semibold text-alpha">{list.length}</Text>
              </View>
            )}
            {isOwnProfile && (
              <TouchableOpacity
                onPress={openAdd}
                hitSlop={10}
                activeOpacity={0.7}
                className="w-7 h-7 rounded-full bg-alpha items-center justify-center"
              >
                <Ionicons name="add" size={16} color="#212529" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {list.length === 0 ? (
          <View className="items-center py-8">
            <Ionicons
              name="briefcase-outline"
              size={36}
              color={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
            />
            <Text className="text-xs text-black/30 dark:text-white/30 mt-2">
              No experience added yet
            </Text>
            {isOwnProfile && (
              <TouchableOpacity
                onPress={openAdd}
                activeOpacity={0.7}
                className="mt-3 px-4 py-2 rounded-full bg-alpha/15 flex-row items-center gap-1"
              >
                <Ionicons name="add-circle-outline" size={15} color="#ffc801" />
                <Text className="text-xs font-bold text-alpha">Add Experience</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View className="px-4 pt-4 pb-2">
            {list.map((exp, idx) => {
              const title = exp?.title ?? exp?.position ?? exp?.role ?? 'Role';
              const company = exp?.company ?? exp?.company_name ?? exp?.organization ?? null;
              const hasExplicitEnd = !!(exp?.end_date ?? exp?.to ?? exp?.ended_at ?? exp?.endDate ?? exp?.end_year ?? exp?.endYear);
              const isCurrent = exp?.is_current ?? exp?.current ?? (!hasExplicitEnd);
              const startDate = exp?.start_date ?? exp?.from ?? exp?.started_at ?? null;
              const endDate = exp?.end_date ?? exp?.to ?? exp?.ended_at ?? null;
              const startMonth = exp?.start_month ?? exp?.startMonth ?? null;
              const startYear = exp?.start_year ?? exp?.startYear ?? null;
              const endMonth = exp?.end_month ?? exp?.endMonth ?? null;
              const endYear = exp?.end_year ?? exp?.endYear ?? null;
              const location = exp?.location ?? exp?.city ?? exp?.place ?? null;
              const rawDescription =
                exp?.description ??
                exp?.desc ??
                exp?.summary ??
                exp?.details ??
                exp?.responsibilities ??
                exp?.body ??
                exp?.content ??
                exp?.overview ??
                exp?.notes ??
                exp?.note ??
                exp?.text ??
                null;
              // Strip HTML tags in case the backend returns rich-text HTML
              const description =
                typeof rawDescription === 'string'
                  ? rawDescription.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
                  : null;
              const period =
                formatPeriod(startDate, endDate, isCurrent) ??
                formatPeriodFromParts(startMonth, startYear, endMonth, endYear, isCurrent);
              const duration =
                calcDuration(startDate, endDate, isCurrent) ??
                calcDurationFromParts(startMonth, startYear, endMonth, endYear, isCurrent);
              const isLast = idx === list.length - 1;
              const itemKey = String(exp?.id ?? `${idx}-${title}-${company ?? ''}`);
              const descText = description ?? '';
              const isDescTruncatable = descText.length > MAX_DESC_CHARS;
              const isDescExpanded = !!expandedByKey?.[itemKey];
              const displayedDesc =
                !descText
                  ? null
                  : isDescExpanded || !isDescTruncatable
                    ? descText
                    : `${descText.slice(0, MAX_DESC_CHARS).trimEnd()}…`;

              return (
                <View key={itemKey} className="flex-row">
                  {/* ── Left rail: dot + line ── */}
                  <View className="items-center mr-3" style={{ width: 20 }}>
                    {/* Dot */}
                    <View
                      className="w-4 h-4 rounded-full items-center justify-center mt-0.5"
                      style={{
                        backgroundColor: isCurrent ? '#ffc801' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'),
                        borderWidth: isCurrent ? 0 : 2,
                        borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                      }}
                    >
                      {isCurrent && (
                        <View className="w-2 h-2 rounded-full bg-beta" />
                      )}
                    </View>
                    {/* Connector line */}
                    {!isLast && (
                      <View
                        className="flex-1 mt-1"
                        style={{
                          width: 1.5,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                          minHeight: 24,
                        }}
                      />
                    )}
                  </View>

                  {/* ── Right: content ── */}
                  <View className={`flex-1 ${!isLast ? 'pb-5' : 'pb-2'}`}>
                    {/* Role title row */}
                    <View className="flex-row items-start justify-between gap-2">
                      <Text className="text-sm font-bold text-black dark:text-white flex-1 leading-[20px]">
                        {title}
                      </Text>
                      <View className="flex-row items-center gap-1.5 shrink-0">
                        {/* Duration pill */}
                        {duration ? (
                          <View className="px-2 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08]">
                            <Text className="text-[10px] font-semibold text-black/50 dark:text-dark_gray0">
                              {duration}
                            </Text>
                          </View>
                        ) : null}
                        {/* Edit button — own profile only */}
                        {isOwnProfile && (
                          <TouchableOpacity
                            onPress={() => openEdit(exp)}
                            hitSlop={10}
                            activeOpacity={0.7}
                            className="w-6 h-6 rounded-full bg-black/[0.05] dark:bg-white/[0.08] items-center justify-center"
                          >
                            <Ionicons
                              name="pencil"
                              size={11}
                              color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Company */}
                    {company ? (
                      <Text className="text-sm text-black/65 dark:text-white/65 mt-0.5 font-medium">
                        {company}
                      </Text>
                    ) : null}

                    {/* Date range row */}
                    {period ? (
                      <View className="flex-row items-center gap-1.5 mt-1.5">
                        <Ionicons
                          name="calendar-outline"
                          size={11}
                          color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                        />
                        <Text className="text-xs text-black/40 dark:text-white/40">{period}</Text>
                        {isCurrent && (
                          <View className="ml-1 px-1.5 py-0.5 rounded-full bg-alpha/20">
                            <Text className="text-[10px] font-bold text-alpha">Now</Text>
                          </View>
                        )}
                      </View>
                    ) : null}

                    {/* Location */}
                    {location ? (
                      <View className="flex-row items-center gap-1 mt-1">
                        <Ionicons
                          name="location-outline"
                          size={11}
                          color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                        />
                        <Text className="text-xs text-black/35 dark:text-white/35">{location}</Text>
                      </View>
                    ) : null}

                    {/* Description + see more/less */}
                    {displayedDesc ? (
                      <View className="mt-2 pl-3 border-l-2 border-alpha/30">
                        <Text className="text-[13px] text-black/55 dark:text-dark_gray5 leading-[20px]">
                          {displayedDesc}
                        </Text>
                        {isDescTruncatable && (
                          <TouchableOpacity
                            onPress={() => toggleExpanded(itemKey)}
                            activeOpacity={0.7}
                            hitSlop={10}
                          >
                            <Text className="mt-1.5 text-xs text-alpha font-bold uppercase tracking-wide">
                              {isDescExpanded ? 'See less ↑' : 'See more ↓'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ── Add / Edit modal ── */}
      <ExperienceFormModal
        visible={formModal.visible}
        experience={formModal.experience}
        token={token}
        isDark={isDark}
        onClose={closeForm}
        onSaved={(saved) => {
          if (formModal.experience) {
            onExperienceUpdated?.(saved);
          } else {
            onExperienceAdded?.(saved);
          }
        }}
        onDeleted={(id) => onExperienceDeleted?.(id)}
      />
    </>
  );
}
