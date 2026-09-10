export type AppLocale = "en" | "so" | "ar";

export const LOCALES: { code: AppLocale; label: string; native: string; dir: "ltr" | "rtl" }[] = [
  { code: "en", label: "English", native: "English", dir: "ltr" },
  { code: "so", label: "Somali", native: "Soomaali", dir: "ltr" },
  { code: "ar", label: "Arabic", native: "العربية", dir: "rtl" },
];

export const LOCALE_STORAGE_KEY = "hilaac_locale";

/** Critical UI strings — expand progressively. */
export type MessageKey =
  | "nav.dashboard"
  | "nav.menu"
  | "nav.tables"
  | "nav.inventory"
  | "nav.orders"
  | "nav.reports"
  | "nav.alerts"
  | "nav.expenses"
  | "nav.deyn"
  | "nav.customers"
  | "nav.promotion"
  | "nav.staff"
  | "nav.settings"
  | "nav.billing"
  | "nav.logout"
  | "common.save"
  | "common.cancel"
  | "common.loading"
  | "common.search"
  | "common.confirm"
  | "dash.ordersToday"
  | "dash.revenueToday"
  | "dash.activeTables"
  | "dash.openOrders"
  | "dash.todaysOrders"
  | "dash.live"
  | "lang.label"
  | "landing.login"
  | "landing.dashboard"
  | "landing.tryDemo"
  | "order.menu"
  | "order.cart"
  | "order.checkout";

type Dict = Record<MessageKey, string>;

const en: Dict = {
  "nav.dashboard": "Dashboard",
  "nav.menu": "Menu",
  "nav.tables": "Tables",
  "nav.inventory": "Inventory",
  "nav.orders": "Orders",
  "nav.reports": "Reports",
  "nav.alerts": "Alerts",
  "nav.expenses": "Expenses",
  "nav.deyn": "Deyn",
  "nav.customers": "Customers",
  "nav.promotion": "Promotion",
  "nav.staff": "Staff",
  "nav.settings": "Settings",
  "nav.billing": "Billing",
  "nav.logout": "Logout",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.loading": "Loading…",
  "common.search": "Search",
  "common.confirm": "Confirm",
  "dash.ordersToday": "Orders Today",
  "dash.revenueToday": "Revenue Today",
  "dash.activeTables": "Active Tables",
  "dash.openOrders": "Open Orders",
  "dash.todaysOrders": "Today's Orders",
  "dash.live": "Live",
  "lang.label": "Language",
  "landing.login": "Log in",
  "landing.dashboard": "Go to Dashboard",
  "landing.tryDemo": "Try Demo",
  "order.menu": "Menu",
  "order.cart": "Cart",
  "order.checkout": "Checkout",
};

const so: Dict = {
  "nav.dashboard": "Dashboard",
  "nav.menu": "Liiska cuntada",
  "nav.tables": "Miisaska",
  "nav.inventory": "Kaydadka",
  "nav.orders": "Dalabaadka",
  "nav.reports": "Warbixinada",
  "nav.alerts": "Digniinaha",
  "nav.expenses": "Kharashaadka",
  "nav.deyn": "Deyn",
  "nav.customers": "Macaamiisha",
  "nav.promotion": "Promotion",
  "nav.staff": "Shaqaalaha",
  "nav.settings": "Dejinta",
  "nav.billing": "Bixinta",
  "nav.logout": "Ka bax",
  "common.save": "Kaydi",
  "common.cancel": "Jooji",
  "common.loading": "Waa la soo rarayaa…",
  "common.search": "Raadi",
  "common.confirm": "Xaqiiji",
  "dash.ordersToday": "Dalabaadka maanta",
  "dash.revenueToday": "Dakhliga maanta",
  "dash.activeTables": "Miisas firfircoon",
  "dash.openOrders": "Dalabaad furan",
  "dash.todaysOrders": "Dalabaadka maanta",
  "dash.live": "Toos ah",
  "lang.label": "Luqadda",
  "landing.login": "Gal",
  "landing.dashboard": "Tag Dashboard",
  "landing.tryDemo": "Isku day Demo",
  "order.menu": "Cuntada",
  "order.cart": "Gaadhiga",
  "order.checkout": "Bixi",
};

const ar: Dict = {
  "nav.dashboard": "لوحة التحكم",
  "nav.menu": "القائمة",
  "nav.tables": "الطاولات",
  "nav.inventory": "المخزون",
  "nav.orders": "الطلبات",
  "nav.reports": "التقارير",
  "nav.alerts": "التنبيهات",
  "nav.expenses": "المصروفات",
  "nav.deyn": "دين",
  "nav.customers": "العملاء",
  "nav.promotion": "العروض",
  "nav.staff": "الموظفون",
  "nav.settings": "الإعدادات",
  "nav.billing": "الفوترة",
  "nav.logout": "تسجيل الخروج",
  "common.save": "حفظ",
  "common.cancel": "إلغاء",
  "common.loading": "جارٍ التحميل…",
  "common.search": "بحث",
  "common.confirm": "تأكيد",
  "dash.ordersToday": "طلبات اليوم",
  "dash.revenueToday": "إيرادات اليوم",
  "dash.activeTables": "طاولات نشطة",
  "dash.openOrders": "طلبات مفتوحة",
  "dash.todaysOrders": "طلبات اليوم",
  "dash.live": "مباشر",
  "lang.label": "اللغة",
  "landing.login": "تسجيل الدخول",
  "landing.dashboard": "الذهاب للوحة التحكم",
  "landing.tryDemo": "تجربة العرض",
  "order.menu": "القائمة",
  "order.cart": "السلة",
  "order.checkout": "الدفع",
};

const DICTS: Record<AppLocale, Dict> = { en, so, ar };

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "en" || value === "so" || value === "ar";
}

export function localeDir(locale: AppLocale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function translate(locale: AppLocale, key: MessageKey): string {
  return DICTS[locale][key] ?? DICTS.en[key] ?? key;
}

/** Map English nav labels (hardcoded in sidebar) to message keys. */
export const NAV_LABEL_TO_KEY: Record<string, MessageKey> = {
  Dashboard: "nav.dashboard",
  Menu: "nav.menu",
  Tables: "nav.tables",
  Inventory: "nav.inventory",
  Orders: "nav.orders",
  Reports: "nav.reports",
  Alerts: "nav.alerts",
  Expenses: "nav.expenses",
  Deyn: "nav.deyn",
  Customers: "nav.customers",
  Promotion: "nav.promotion",
  Staff: "nav.staff",
  Settings: "nav.settings",
  Billing: "nav.billing",
};
