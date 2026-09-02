import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPeriod, formatPeriodFromParts } from './_helpers';

export default function EducationCard({ profile, isDark }) {
  const rawList =
    profile?.education ??
    profile?.educations ??
    profile?.user_education ??
    profile?.userEducation ??
    [];
  const list = Array.isArray(rawList) ? rawList.filter(Boolean) : [];

  return (
    <View className="mx-4 mb-3 rounded-2xl bg-light dark:bg-dark border border-black/10 dark:border-white/10 p-4">
      <Text className="text-base font-bold text-black dark:text-white mb-4">Education</Text>

      {list.length === 0 ? (
        <View className="items-center py-4">
          <Ionicons
            name="school-outline"
            size={36}
            color={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
          />
          <Text className="text-xs text-black/30 dark:text-white/30 mt-2">
            No education added yet
          </Text>
        </View>
      ) : (
        list.map((edu, idx) => {
          const institution =
            edu?.institution ?? edu?.school ?? edu?.university ?? edu?.college ?? 'School';
          const degree = edu?.degree ?? edu?.diploma ?? edu?.level ?? null;
          const field =
            edu?.field ?? edu?.field_of_study ?? edu?.specialization ?? edu?.major ?? null;
          const startDate = edu?.start_date ?? edu?.from ?? edu?.started_at ?? null;
          const endDate = edu?.end_date ?? edu?.to ?? edu?.ended_at ?? null;
          const startMonth = edu?.start_month ?? edu?.startMonth ?? null;
          const startYear = edu?.start_year ?? edu?.startYear ?? null;
          const endMonth = edu?.end_month ?? edu?.endMonth ?? null;
          const endYear = edu?.end_year ?? edu?.endYear ?? null;
          const isCurrent = edu?.is_current ?? edu?.current ?? !endDate;
          const description = edu?.description ?? edu?.activities ?? null;
          const period =
            formatPeriod(startDate, endDate, isCurrent) ??
            formatPeriodFromParts(startMonth, startYear, endMonth, endYear, isCurrent);
          const isLast = idx === list.length - 1;

          return (
            <View
              key={edu?.id ?? idx}
              className={`flex-row ${!isLast ? 'pb-5 mb-4 border-b border-black/5 dark:border-dark_gray' : ''}`}
            >
              {/* School icon badge */}
              <View className="w-12 h-12 rounded-xl bg-alpha/10 items-center justify-center mr-3 mt-0.5 shrink-0">
                <Ionicons name="school-outline" size={20} color="#ffc801" />
              </View>

              <View className="flex-1">
                <Text className="text-sm font-bold text-black dark:text-white leading-snug">
                  {institution}
                </Text>
                {(degree || field) ? (
                  <Text className="text-sm text-black/60 dark:text-white/60 mt-0.5">
                    {[degree, field].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                {period ? (
                  <Text className="text-xs text-black/40 dark:text-white/40 mt-0.5">{period}</Text>
                ) : null}
                {description ? (
                  <Text
                    className="text-sm text-black/55 dark:text-dark_gray5 mt-1.5 leading-[20px]"
                    numberOfLines={3}
                  >
                    {description}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}
