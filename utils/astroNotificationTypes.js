/**
 * Astrology Notification Types
 * These are sent in the `data` payload so your React Native app
 * can navigate to the correct screen upon notification tap.
 */

export const ASTRO_NOTIFICATION_TYPES = {
  DAILY_HOROSCOPE:      "daily_horoscope",
  WEEKLY_HOROSCOPE:     "weekly_horoscope",
  MONTHLY_HOROSCOPE:    "monthly_horoscope",
  KUNDALI_READY:        "kundali_ready",
  PLANET_TRANSIT:       "planet_transit",
  LUCKY_DAY_ALERT:      "lucky_day_alert",
  REMEDIES:             "remedies",
  PANCHANG:             "panchang",
  COMPATIBILITY:        "compatibility",
  NAKSHATRA_ALERT:      "nakshatra_alert",
  DASHA_CHANGE:         "dasha_change",
  ECLIPSE_ALERT:        "eclipse_alert",
  RETROGRADE_ALERT:     "retrograde_alert",
  FESTIVAL_MUHURAT:     "festival_muhurat",
  CUSTOM:               "custom",
};

/**
 * Maps each notification type to the React Native screen name.
 * Your RN app should read `data.screen` from the notification payload
 * and navigate accordingly.
 */
export const ASTRO_SCREEN_MAP = {
  [ASTRO_NOTIFICATION_TYPES.DAILY_HOROSCOPE]:   "DailyHoroscopeScreen",
  [ASTRO_NOTIFICATION_TYPES.WEEKLY_HOROSCOPE]:  "WeeklyHoroscopeScreen",
  [ASTRO_NOTIFICATION_TYPES.MONTHLY_HOROSCOPE]: "MonthlyHoroscopeScreen",
  [ASTRO_NOTIFICATION_TYPES.KUNDALI_READY]:     "KundaliScreen",
  [ASTRO_NOTIFICATION_TYPES.PLANET_TRANSIT]:    "PlanetTransitScreen",
  [ASTRO_NOTIFICATION_TYPES.LUCKY_DAY_ALERT]:   "LuckyDayScreen",
  [ASTRO_NOTIFICATION_TYPES.REMEDIES]:          "RemediesScreen",
  [ASTRO_NOTIFICATION_TYPES.PANCHANG]:          "PanchangScreen",
  [ASTRO_NOTIFICATION_TYPES.COMPATIBILITY]:     "CompatibilityScreen",
  [ASTRO_NOTIFICATION_TYPES.NAKSHATRA_ALERT]:   "NakshatraScreen",
  [ASTRO_NOTIFICATION_TYPES.DASHA_CHANGE]:      "DashaScreen",
  [ASTRO_NOTIFICATION_TYPES.ECLIPSE_ALERT]:     "EclipseScreen",
  [ASTRO_NOTIFICATION_TYPES.RETROGRADE_ALERT]:  "RetrogradeScreen",
  [ASTRO_NOTIFICATION_TYPES.FESTIVAL_MUHURAT]:  "MuhuratScreen",
  [ASTRO_NOTIFICATION_TYPES.CUSTOM]:            "HomeScreen",
};

/**
 * Default notification templates per type.
 * Override title/body when calling the API if needed.
 */
export const ASTRO_NOTIFICATION_TEMPLATES = {
  [ASTRO_NOTIFICATION_TYPES.DAILY_HOROSCOPE]: {
    title: "🌟 Your Daily Horoscope is Ready",
    body: "Discover what the stars have in store for you today.",
  },
  [ASTRO_NOTIFICATION_TYPES.WEEKLY_HOROSCOPE]: {
    title: "🔭 Weekly Forecast is Here",
    body: "Plan your week ahead with cosmic guidance.",
  },
  [ASTRO_NOTIFICATION_TYPES.MONTHLY_HOROSCOPE]: {
    title: "📅 Monthly Horoscope Update",
    body: "Your monthly planetary overview is now available.",
  },
  [ASTRO_NOTIFICATION_TYPES.KUNDALI_READY]: {
    title: "📜 Your Kundali is Ready",
    body: "Your birth chart has been generated. Tap to explore.",
  },
  [ASTRO_NOTIFICATION_TYPES.PLANET_TRANSIT]: {
    title: "🪐 Planet Transit Alert",
    body: "A significant planetary transit is affecting your sign.",
  },
  [ASTRO_NOTIFICATION_TYPES.LUCKY_DAY_ALERT]: {
    title: "🍀 Lucky Day Alert!",
    body: "Today is highly auspicious for you. Make the most of it!",
  },
  [ASTRO_NOTIFICATION_TYPES.REMEDIES]: {
    title: "🙏 Today's Astrological Remedy",
    body: "A simple remedy to strengthen your planetary energies.",
  },
  [ASTRO_NOTIFICATION_TYPES.PANCHANG]: {
    title: "🗓️ Today's Panchang",
    body: "Tithi, Nakshatra, Yoga & Karan details for today.",
  },
  [ASTRO_NOTIFICATION_TYPES.COMPATIBILITY]: {
    title: "💑 Compatibility Report Ready",
    body: "Your relationship compatibility analysis is available.",
  },
  [ASTRO_NOTIFICATION_TYPES.NAKSHATRA_ALERT]: {
    title: "⭐ Nakshatra Insight",
    body: "Your birth Nakshatra has a special message for you today.",
  },
  [ASTRO_NOTIFICATION_TYPES.DASHA_CHANGE]: {
    title: "🔄 Dasha Period Change",
    body: "A new Dasha period is beginning. See how it affects you.",
  },
  [ASTRO_NOTIFICATION_TYPES.ECLIPSE_ALERT]: {
    title: "🌑 Eclipse Alert",
    body: "An upcoming eclipse may influence your zodiac sign.",
  },
  [ASTRO_NOTIFICATION_TYPES.RETROGRADE_ALERT]: {
    title: "⚠️ Retrograde Alert",
    body: "A planet is going retrograde. Here's what to expect.",
  },
  [ASTRO_NOTIFICATION_TYPES.FESTIVAL_MUHURAT]: {
    title: "🎉 Auspicious Muhurat Today",
    body: "Today has an auspicious muhurat for important events.",
  },
};
