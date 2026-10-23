/** All business dates are computed in this timezone */
export const TIMEZONE = "Asia/Kolkata" as const;

/** QR token rotation window in seconds */
export const QR_ROTATION_SECONDS = 45;

/** How many time steps back the server will accept (tolerance = 1 step = 45s) */
export const QR_TOLERANCE_STEPS = 1;

/** Duplicate check-in window */
export const DUPLICATE_WINDOW_HOURS = 3;

/** Default absence threshold for Red List */
export const DEFAULT_NO_SHOW_THRESHOLD_DAYS = 10;

/** Default weekly visit goal */
export const DEFAULT_WEEKLY_TARGET = 4;

/** Renewal reminder stages in days relative to expiry (negative = overdue) */
export const RENEWAL_WINDOWS = [14, 7, 3, 0, -3] as const;

/** Member notification stages (owner-only 14-day stage excluded) */
export const MEMBER_REMINDER_WINDOWS = [7, 3, 0, -3] as const;

/** Payment states */
export const PAYMENT_STATUS = {
  CREATED: "Created",
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
} as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

/** Member statuses */
export const MEMBER_STATUS = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  BLOCKED: "Blocked",
} as const;

export type MemberStatus = (typeof MEMBER_STATUS)[keyof typeof MEMBER_STATUS];

/** Membership statuses */
export const MEMBERSHIP_STATUS = {
  PENDING: "Pending",
  ACTIVE: "Active",
  FROZEN: "Frozen",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
} as const;

export type MembershipStatus =
  (typeof MEMBERSHIP_STATUS)[keyof typeof MEMBERSHIP_STATUS];

/** No-show case statuses */
export const CASE_STATUS = {
  OPEN: "Open",
  CONTACTED: "Contacted",
  FOLLOW_UP_DUE: "FollowUpDue",
  RETURNED: "Returned",
  CLOSED: "Closed",
} as const;

export type CaseStatus = (typeof CASE_STATUS)[keyof typeof CASE_STATUS];

/** Follow-up outcomes */
export const FOLLOW_UP_OUTCOME = {
  WILL_RETURN: "WillReturn",
  INJURED: "Injured",
  TRAVELLING: "Travelling",
  TIMING_ISSUE: "TimingIssue",
  UNHAPPY: "Unhappy",
  NO_RESPONSE: "NoResponse",
  CANCELLED: "Cancelled",
} as const;

export type FollowUpOutcome =
  (typeof FOLLOW_UP_OUTCOME)[keyof typeof FOLLOW_UP_OUTCOME];

/** Add-on types */
export const ADDON_TYPE = {
  PT: "PT",
  DIET: "Diet",
  PRODUCT: "Product",
} as const;

export type AddonType = (typeof ADDON_TYPE)[keyof typeof ADDON_TYPE];

/** Staff roles */
export const STAFF_ROLE = {
  OWNER: "Owner",
  FRONT_DESK: "FrontDesk",
} as const;

export type StaffRole = (typeof STAFF_ROLE)[keyof typeof STAFF_ROLE];

/** Check-in source */
export const CHECKIN_SOURCE = {
  QR: "QR",
  ASSISTED: "Assisted",
} as const;

export type CheckinSource = (typeof CHECKIN_SOURCE)[keyof typeof CHECKIN_SOURCE];

/** API error codes */
export const ERROR_CODES = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION",
  DUPLICATE_CHECKIN: "DUPLICATE_CHECKIN",
  QR_EXPIRED: "QR_EXPIRED",
  QR_INVALID: "QR_INVALID",
  MEMBERSHIP_EXPIRED: "MEMBERSHIP_EXPIRED",
  MEMBERSHIP_PAUSED: "MEMBERSHIP_PAUSED",
  MEMBER_BLOCKED: "MEMBER_BLOCKED",
  MEMBER_CANCELLED: "MEMBER_CANCELLED",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  TRAINER_UNAVAILABLE: "TRAINER_UNAVAILABLE",
  ALREADY_VERIFIED: "ALREADY_VERIFIED",
  INVALID_STATE: "INVALID_STATE",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
