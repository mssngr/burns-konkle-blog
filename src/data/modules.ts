// The sidebar: every module of the family site. Paths are relative to the site base.

export type IconName =
  | 'home'
  | 'help'
  | 'calendar'
  | 'meal'
  | 'hand'
  | 'gift'
  | 'news'
  | 'heart'
  | 'rules'
  | 'dashboard'
  | 'clock'
  | 'inbox'
  | 'flag'
  | 'list'
  | 'mail'
  | 'log'
  | 'settings'
  | 'user'

export interface Module {
  key: string
  href: string
  label: string
  icon: IconName
  /** Gabriel and Micala only. */
  admin?: boolean
}

export const publicModules: Module[] = [
  { key: 'home', href: '', label: 'Home', icon: 'home' },
  { key: 'how', href: 'how-it-works/', label: 'How this works', icon: 'help' },
  { key: 'visits', href: 'visits/', label: 'Visit calendar', icon: 'calendar' },
  { key: 'meals', href: 'meals/', label: 'Meal Train', icon: 'meal' },
  { key: 'offer', href: 'offer/', label: 'Offer help', icon: 'hand' },
  { key: 'registry', href: 'registry/', label: 'Baby registry', icon: 'gift' },
  {
    key: 'updates',
    href: 'updates/',
    label: 'Baby & Micala updates',
    icon: 'news',
  },
  {
    key: 'notes',
    href: 'notes/',
    label: 'Family & friends notes',
    icon: 'heart',
  },
  { key: 'rules', href: 'rules/', label: 'House rules', icon: 'rules' },
]

export const familyModules: Module[] = [
  { key: 'family', href: 'family/', label: 'Dashboard', icon: 'dashboard' },
  {
    key: 'family-visits',
    href: 'family/visits/',
    label: 'Visits & blocks',
    icon: 'calendar',
  },
  {
    key: 'family-meals',
    href: 'family/meals/',
    label: 'Meal Train',
    icon: 'meal',
  },
  {
    key: 'family-schedule',
    href: 'family/schedule/',
    label: 'Family schedule',
    icon: 'clock',
  },
  {
    key: 'family-offers',
    href: 'family/offers/',
    label: 'Offers of help',
    icon: 'inbox',
  },
  {
    key: 'family-notes',
    href: 'family/notes/',
    label: 'Notes to publish',
    icon: 'heart',
  },
  {
    key: 'family-visitors',
    href: 'family/visitors/',
    label: 'Visitors & flags',
    icon: 'flag',
  },
  {
    key: 'thanks',
    href: 'thanks/',
    label: 'Registry thank-yous',
    icon: 'list',
    admin: true,
  },
  {
    key: 'family-outbox',
    href: 'family/outbox/',
    label: 'Sent emails',
    icon: 'mail',
    admin: true,
  },
  {
    key: 'family-activity',
    href: 'family/activity/',
    label: 'Activity log',
    icon: 'log',
    admin: true,
  },
  {
    key: 'family-settings',
    href: 'family/settings/',
    label: 'Settings',
    icon: 'settings',
    admin: true,
  },
]

/** 24×24 stroke icons. */
export const ICONS: Record<IconName, string> = {
  home: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17.5v.01',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h2M12 14h2M16 14h0M8 17h2',
  meal: 'M4 14h16a8 8 0 0 1-16 0zM12 6v3M8.5 7l1 2.5M15.5 7l-1 2.5M2 20h20',
  hand: 'M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L3.5 14a1.5 1.5 0 0 1 2.5-1.7L7 14',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1.5S10 7 12 7zM12 7c1.5-3 5-3.5 5-1.5S14 7 12 7z',
  news: 'M5 4h12v16H6a2 2 0 0 1-2-2V8M17 8h3v10a2 2 0 0 1-4 0M8 8h6M8 12h6M8 16h4',
  heart:
    'M12 20s-7-4.4-9-9a4.5 4.5 0 0 1 9-3 4.5 4.5 0 0 1 9 3c-2 4.6-9 9-9 9z',
  rules: 'M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4',
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  inbox: 'M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  log: 'M12 21a9 9 0 1 0-9-9M3 12l2.5-2.5M3 12l-2-2M12 7v5l3 3',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15.1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
}
