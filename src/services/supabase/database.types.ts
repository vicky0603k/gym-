/**
 * Hand-authored type stubs matching supabase/migrations/001_tables.sql.
 *
 * This file will be overwritten by:
 *   npx supabase gen types typescript --project-id <id> --schema public
 * once a real Supabase project is connected. Until then the hand-authored
 * types serve as the build-time contract.
 *
 * DO NOT add business logic here — use src/services/ for that.
 *
 * NOTE: Row types use `type` aliases (not `interface`) so they satisfy the
 * Supabase SDK's `GenericTable` constraint which requires `Record<string,
 * unknown>` assignability. Interfaces lack implicit index signatures.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─── Enum types ────────────────────────────────────────────────────────────

export type MemberStatus = "Active" | "Paused" | "Expired" | "Cancelled" | "Blocked";
export type MembershipStatus = "Pending" | "Active" | "Frozen" | "Expired" | "Cancelled";
export type AttendanceSource = "QR" | "Assisted";
export type CaseStatus = "Open" | "Contacted" | "FollowUpDue" | "Returned" | "Closed";
export type FollowUpChannel = "Call" | "WhatsApp" | "InPerson";
export type FollowUpOutcome =
  | "WillReturn"
  | "Injured"
  | "Travelling"
  | "TimingIssue"
  | "Unhappy"
  | "NoResponse"
  | "Cancelled";
export type PaymentPurpose = "Renewal" | "AddOn";
export type PaymentStatus = "Created" | "Pending" | "Paid" | "Failed" | "Refunded";
export type RenewalOrderStatus = "Pending" | "Paid" | "Failed" | "Cancelled";
export type AddonType = "PT" | "Diet" | "Product";
export type AddonOrderStatus =
  | "Pending"
  | "Paid"
  | "Active"
  | "Completed"
  | "Cancelled"
  | "Refunded";
export type NotificationTemplate =
  | "NoShowCare"
  | "RenewalReminder"
  | "PaymentSuccess"
  | "PaymentFailed"
  | "Streak"
  | "PTReminder";
export type NotificationChannel = "WhatsApp" | "Push" | "InApp";
export type NotificationStatus =
  | "Scheduled"
  | "Sent"
  | "Delivered"
  | "Failed"
  | "Clicked"
  | "Converted"
  | "OptedOut";
export type StaffRole = "Owner" | "FrontDesk";

// ─── Row types (type aliases, not interfaces — see header note) ────────────

export type Member = {
  id: string;
  name: string;
  phone: string;
  pin_hash: string;
  status: MemberStatus;
  assigned_trainer_id: string | null;
  weekly_target: number;
  join_date: string;
  marketing_consent: boolean;
  notes: string | null;
  pin_failed_attempts: number;
  pin_locked_until: string | null;
  notify_renewal: boolean; // 010
  notify_care: boolean; // 010
  member_code: number; // 013 — unique 6 digits, shown as e.g. FL-346587
  created_at: string;
  updated_at: string;
};

export type Trainer = {
  id: string;
  name: string;
  phone: string;
  specialisation: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StaffUser = {
  id: string;
  name: string;
  role: StaffRole;
  is_active: boolean; // 012
  created_at: string;
  updated_at: string;
};

export type Plan = {
  id: string;
  name: string;
  duration_days: number;
  price: number;
  discount_pct: number;
  benefits: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Membership = {
  id: string;
  member_id: string;
  plan_id: string;
  start_date: string;
  expiry_date: string;
  status: MembershipStatus;
  freeze_start: string | null;
  freeze_end: string | null;
  renewal_source: string | null;
  created_at: string;
  updated_at: string;
};

export type Attendance = {
  id: string;
  member_id: string;
  checkin_at: string;
  source: AttendanceSource;
  qr_session_id: string | null;
  staff_id: string | null;
  correction_reason: string | null;
  created_at: string;
};

export type NoShowCase = {
  id: string;
  member_id: string;
  opened_on: string;
  absent_days_at_open: number;
  status: CaseStatus;
  assigned_staff_id: string | null;
  next_action_date: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FollowUp = {
  id: string;
  case_id: string;
  channel: FollowUpChannel;
  outcome: FollowUpOutcome;
  notes: string | null;
  staff_id: string;
  created_at: string;
  next_action_date: string | null;
};

export type Payment = {
  id: string;
  member_id: string;
  purpose: PaymentPurpose;
  ref_id: string;
  provider_ref: string | null;
  amount: number;
  status: PaymentStatus;
  verified_by: string | null;
  verified_at: string | null;
  method: PaymentMethod; // 012
  created_at: string;
  updated_at: string;
};

export type PaymentMethod = "UPI" | "Cash";

export type FreezeCredit = {
  id: string;
  membership_id: string;
  member_id: string;
  days: number;
  credited_on: string;
  staff_id: string | null;
  created_at: string;
};

export type RenewalOrder = {
  id: string;
  membership_id: string;
  plan_id: string;
  amount: number;
  discount: number;
  payment_id: string;
  status: RenewalOrderStatus;
  new_expiry: string | null; // set once by verify_payment (009)
  created_at: string;
  updated_at: string;
};

export type Addon = {
  id: string;
  type: AddonType;
  title: string;
  description: string | null;
  price: number;
  validity_days: number;
  sessions: number | null;
  stock: number | null;
  trainer_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AddonOrder = {
  id: string;
  member_id: string;
  addon_id: string;
  trainer_id: string | null;
  quantity: number;
  amount: number;
  payment_id: string;
  sessions_total: number | null;
  sessions_used: number | null;
  status: AddonOrderStatus;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  member_id: string;
  template: NotificationTemplate;
  channel: NotificationChannel;
  scheduled_at: string;
  sent_at: string | null;
  status: NotificationStatus;
  created_at: string;
};

export type Settings = {
  id: string;
  gym_name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  timezone: string;
  no_show_threshold_days: number;
  qr_rotation_seconds: number;
  duplicate_window_hours: number;
  renewal_windows: number[];
  weekly_goal_default: number;
  opening_hours: string | null; // 010
  maps_url: string | null;
  upi_id: string | null;
  upi_name: string | null;
  tagline: string | null;
  freeze_max_days_per_year: number; // 012
  gstin: string | null;
  member_id_prefix: string | null; // 013
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  actor_type: string;
  actor_id: string;
  action: string;
  record_type: string;
  record_id: string;
  summary: string;
  created_at: string;
};

export type PaymentRpcErrorCode =
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "ALREADY_VERIFIED"
  | "INVALID_STATE";

export type PaymentRpcResult<T> =
  | ({ ok: true } & T)
  | { ok: false; code: PaymentRpcErrorCode };

export type CheckInRpcErrorCode =
  | "QR_EXPIRED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "MEMBER_BLOCKED"
  | "MEMBER_CANCELLED"
  | "MEMBERSHIP_PAUSED"
  | "MEMBERSHIP_EXPIRED"
  | "DUPLICATE_CHECKIN";

export type CheckInRpcResult =
  | {
      ok: true;
      attendance_id: string;
      checkin_at: string;
      case_resolved: boolean;
      week_visits: number;
      weekly_target: number;
    }
  | { ok: false; code: CheckInRpcErrorCode; last_checkin_at?: string; expiry_date?: string | null };

export type RedListDbRow = {
  case_id: string;
  member_id: string;
  member_name: string;
  member_phone: string;
  case_status: CaseStatus;
  opened_on: string;
  next_action_date: string | null;
  plan_name: string;
  expiry_date: string;
  join_date: string;
  last_visit: string | null;
  absent_days: number;
  trainer_name: string | null;
  last_followup_at: string | null;
  last_followup_outcome: FollowUpOutcome | null;
  last_followup_channel: FollowUpChannel | null;
  followup_count: number;
  notify_care: boolean;
};

export type RenewalDueDbRow = {
  member_id: string;
  member_name: string;
  member_phone: string;
  plan_name: string;
  renewal_amount: number;
  expiry_date: string;
  days_left: number;
  pending_payment_id: string | null;
  pending_amount: number | null;
  pending_reference: string | null;
  notify_renewal: boolean;
};

export type DashboardKpiRow = {
  active_members: number;
  checkins_today: number;
  active_7_days: number;
  red_list_open: number;
  followups_due: number;
  returned_this_month: number;
  renewals_due_7_count: number;
  renewals_due_7_amount: number;
  renewal_collection_month: number;
  addon_revenue_month: number;
  cases_opened_today: number;
  renewals_paid_today_count: number;
  renewals_paid_today_amount: number;
  payments_pending: number;
};

export type DataQualityRow = {
  paid_without_reference: number;
  active_past_expiry: number;
  members_without_membership: number;
  payments_pending_over_3_days: number;
  stock_below_zero: number;
};

// ─── Supabase Database type (used with createClient) ───────────────────────

export type Database = {
  public: {
    Tables: {
      members: {
        Row: Member;
        Insert: Omit<
          Member,
          "id" | "created_at" | "updated_at" | "pin_hash" | "assigned_trainer_id" | "notes" | "status" | "weekly_target" | "join_date" | "marketing_consent" | "pin_failed_attempts" | "pin_locked_until" | "notify_renewal" | "notify_care" | "member_code"
        > & {
          id?: string;
          pin_hash?: string;
          assigned_trainer_id?: string | null;
          notes?: string | null;
          status?: MemberStatus;
          weekly_target?: number;
          join_date?: string;
          marketing_consent?: boolean;
        };
        Update: Partial<Omit<Member, "id" | "created_at">>;
        Relationships: [];
      };
      trainers: {
        Row: Trainer;
        Insert: Omit<
          Trainer,
          "id" | "created_at" | "updated_at" | "phone" | "specialisation" | "is_active"
        > & {
          id?: string;
          phone?: string | null;
          specialisation?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Omit<Trainer, "id" | "created_at">>;
        Relationships: [];
      };
      staff_users: {
        Row: StaffUser;
        Insert: Omit<StaffUser, "created_at" | "updated_at" | "role" | "is_active"> & {
          role?: StaffRole;
          is_active?: boolean;
        };
        Update: Partial<Omit<StaffUser, "id" | "created_at">>;
        Relationships: [];
      };
      plans: {
        Row: Plan;
        Insert: Omit<
          Plan,
          "id" | "created_at" | "updated_at" | "benefits" | "discount_pct" | "is_active"
        > & {
          id?: string;
          benefits?: string | null;
          discount_pct?: number;
          is_active?: boolean;
        };
        Update: Partial<Omit<Plan, "id" | "created_at">>;
        Relationships: [];
      };
      memberships: {
        Row: Membership;
        Insert: Omit<
          Membership,
          "id" | "created_at" | "updated_at" | "freeze_start" | "freeze_end" | "renewal_source" | "status"
        > & {
          id?: string;
          freeze_start?: string | null;
          freeze_end?: string | null;
          renewal_source?: string | null;
          status?: MembershipStatus;
        };
        Update: Partial<Omit<Membership, "id" | "created_at">>;
        Relationships: [];
      };
      attendance: {
        Row: Attendance;
        Insert: Omit<
          Attendance,
          "id" | "created_at" | "qr_session_id" | "staff_id" | "correction_reason" | "checkin_at"
        > & {
          id?: string;
          qr_session_id?: string | null;
          staff_id?: string | null;
          correction_reason?: string | null;
          checkin_at?: string;
        };
        Update: Partial<Omit<Attendance, "id" | "created_at">>;
        Relationships: [];
      };
      no_show_cases: {
        Row: NoShowCase;
        Insert: Omit<
          NoShowCase,
          "id" | "created_at" | "updated_at" | "assigned_staff_id" | "next_action_date" | "resolved_at" | "status"
        > & {
          id?: string;
          assigned_staff_id?: string | null;
          next_action_date?: string | null;
          resolved_at?: string | null;
          status?: CaseStatus;
        };
        Update: Partial<Omit<NoShowCase, "id" | "created_at">>;
        Relationships: [];
      };
      followups: {
        Row: FollowUp;
        Insert: Omit<FollowUp, "id" | "created_at" | "notes" | "next_action_date"> & {
          id?: string;
          notes?: string | null;
          next_action_date?: string | null;
        };
        Update: never; // append-only
        Relationships: [];
      };
      payments: {
        Row: Payment;
        Insert: Omit<
          Payment,
          "id" | "created_at" | "updated_at" | "provider_ref" | "verified_by" | "verified_at" | "status" | "method"
        > & {
          id?: string;
          method?: PaymentMethod;
          provider_ref?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          status?: PaymentStatus;
        };
        Update: Partial<Omit<Payment, "id" | "created_at">>;
        Relationships: [];
      };
      renewal_orders: {
        Row: RenewalOrder;
        Insert: Omit<
          RenewalOrder,
          "id" | "created_at" | "updated_at" | "discount" | "status" | "new_expiry"
        > & {
          id?: string;
          discount?: number;
          status?: RenewalOrderStatus;
          new_expiry?: string | null;
        };
        Update: Partial<Omit<RenewalOrder, "id" | "created_at">>;
        Relationships: [];
      };
      addons: {
        Row: Addon;
        Insert: Omit<
          Addon,
          "id" | "created_at" | "updated_at" | "description" | "sessions" | "stock" | "trainer_id" | "is_active"
        > & {
          id?: string;
          description?: string | null;
          sessions?: number | null;
          stock?: number | null;
          trainer_id?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Omit<Addon, "id" | "created_at">>;
        Relationships: [];
      };
      addon_orders: {
        Row: AddonOrder;
        Insert: Omit<
          AddonOrder,
          "id" | "created_at" | "updated_at" | "trainer_id" | "sessions_total" | "sessions_used" | "quantity" | "status"
        > & {
          id?: string;
          trainer_id?: string | null;
          sessions_total?: number | null;
          sessions_used?: number | null;
          quantity?: number;
          status?: AddonOrderStatus;
        };
        Update: Partial<Omit<AddonOrder, "id" | "created_at">>;
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, "id" | "created_at" | "sent_at" | "status"> & {
          id?: string;
          sent_at?: string | null;
          status?: NotificationStatus;
        };
        Update: Partial<Omit<Notification, "id" | "created_at">>;
        Relationships: [];
      };
      settings: {
        Row: Settings;
        Insert: Omit<
          Settings,
          "id" | "created_at" | "updated_at" | "logo_url" | "address" | "phone" | "gym_name" | "timezone" | "no_show_threshold_days" | "qr_rotation_seconds" | "duplicate_window_hours" | "renewal_windows" | "weekly_goal_default" | "opening_hours" | "maps_url" | "upi_id" | "upi_name" | "tagline" | "freeze_max_days_per_year" | "gstin" | "member_id_prefix"
        > & {
          member_id_prefix?: string | null;
          freeze_max_days_per_year?: number;
          gstin?: string | null;
          id?: string;
          logo_url?: string | null;
          address?: string | null;
          phone?: string | null;
          gym_name?: string;
          timezone?: string;
          no_show_threshold_days?: number;
          qr_rotation_seconds?: number;
          duplicate_window_hours?: number;
          renewal_windows?: number[];
          weekly_goal_default?: number;
          opening_hours?: string | null;
          maps_url?: string | null;
          upi_id?: string | null;
          upi_name?: string | null;
          tagline?: string | null;
        };
        Update: Partial<Omit<Settings, "id" | "created_at">>;
        Relationships: [];
      };
      freeze_credits: {
        Row: FreezeCredit;
        Insert: never; // written only by resume_membership() (012)
        Update: never;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<AuditLog, "id" | "created_at"> & { id?: string };
        Update: never; // append-only
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      verify_member_pin: {
        Args: { p_phone: string; p_pin_hash: string };
        Returns: string | null;
      };
      // Return shapes mirror the jsonb built in 005_hardening.sql.
      verify_payment: {
        Args: { p_payment_id: string; p_provider_ref: string; p_staff_id: string };
        Returns: PaymentRpcResult<{ new_expiry: string | null; payment_id: string }>; // null for add-ons (010)
      };
      reject_payment: {
        Args: { p_payment_id: string; p_staff_id: string; p_reason: string };
        Returns: PaymentRpcResult<Record<never, never>>;
      };
      // Return shape mirrors the jsonb built in 007_check_in.sql.
      check_in: {
        Args: {
          p_member_id: string;
          p_source: AttendanceSource;
          p_qr_step?: number | null;
          p_staff_id?: string | null;
          p_reason?: string | null;
        };
        Returns: CheckInRpcResult;
      };
      // Shapes mirror 010_addons_dashboard_settings.sql.
      create_addon_order: {
        Args: { p_member_id: string; p_addon_id: string; p_quantity: number };
        Returns:
          | { ok: true; existing: boolean; payment_id: string }
          | { ok: false; code: "VALIDATION" | "NOT_FOUND" | "FORBIDDEN" | "TRAINER_UNAVAILABLE" | "OUT_OF_STOCK"; stock?: number };
      };
      cancel_payment: {
        Args: { p_payment_id: string; p_member_id: string };
        Returns: { ok: true } | { ok: false; code: "NOT_FOUND" | "INVALID_STATE" };
      };
      record_pt_session: {
        Args: { p_order_id: string; p_staff_id: string };
        Returns:
          | { ok: true; sessions_used: number; sessions_total: number }
          | { ok: false; code: "FORBIDDEN" | "NOT_FOUND" | "ALL_USED" | "INVALID_STATE"; sessions_total?: number };
      };
      adjust_stock: {
        Args: { p_addon_id: string; p_delta: number; p_reason: string; p_staff_id: string };
        Returns: { ok: true; stock: number } | { ok: false; code: "FORBIDDEN" | "VALIDATION" | "NOT_FOUND" | "NEGATIVE_STOCK"; stock?: number };
      };
      expire_lapsed_memberships: {
        Args: Record<string, never>;
        Returns: { ok: true; memberships_expired: number; members_expired: number };
      };
      dashboard_kpis: {
        Args: Record<string, never>;
        Returns: DashboardKpiRow;
      };
      // Shapes mirror 012_desk_refund_freeze_staff.sql.
      create_desk_renewal: {
        Args: { p_member_id: string; p_plan_id: string; p_method: PaymentMethod; p_reference: string | null; p_staff_id: string };
        Returns:
          | { ok: true; payment_id: string; reference: string; amount: number }
          | { ok: false; code: "FORBIDDEN" | "VALIDATION" | "DUPLICATE_REFERENCE" | "NOT_FOUND" | "PLAN_UNAVAILABLE" | "PAYMENT_CLAIMED"; payment_id?: string };
      };
      refund_payment: {
        Args: { p_payment_id: string; p_staff_id: string; p_reason: string; p_reverse: boolean };
        Returns: { ok: true; new_expiry: string | null } | { ok: false; code: "FORBIDDEN" | "VALIDATION" | "NOT_FOUND" | "ALREADY_REFUNDED" | "INVALID_STATE" };
      };
      resume_membership: {
        Args: { p_membership_id: string; p_staff_id: string };
        Returns: { ok: true; days_added: number; new_expiry: string } | { ok: false; code: "FORBIDDEN" | "INVALID_STATE" };
      };
      set_member_status: {
        Args: { p_member_id: string; p_action: "Cancel" | "Block" | "Reactivate"; p_reason: string; p_staff_id: string };
        Returns: { ok: true; status: MemberStatus } | { ok: false; code: "FORBIDDEN" | "VALIDATION" | "NOT_FOUND" | "INVALID_STATE" };
      };
      anonymise_member: {
        Args: { p_member_id: string; p_staff_id: string };
        Returns: { ok: true } | { ok: false; code: "FORBIDDEN" | "NOT_FOUND" | "INVALID_STATE" };
      };
      backfill_attendance: {
        Args: { p_member_id: string; p_at: string; p_reason: string; p_staff_id: string };
        Returns: { ok: true; attendance_id: string; case_resolved: boolean } | { ok: false; code: "FORBIDDEN" | "VALIDATION" | "NOT_FOUND" | "DUPLICATE_CHECKIN" };
      };
      member_pin_salt: {
        Args: { p_phone: string };
        Returns: string | null;
      };
      data_quality_issues: {
        Args: Record<string, never>;
        Returns: DataQualityRow;
      };
      // Shapes mirror 009_renewals.sql.
      create_renewal_order: {
        Args: { p_member_id: string; p_plan_id: string };
        Returns:
          | { ok: true; existing: boolean; payment_id: string }
          | { ok: false; code: "NOT_FOUND" | "FORBIDDEN" | "NO_MEMBERSHIP" | "PLAN_UNAVAILABLE" | "PAYMENT_CLAIMED" };
      };
      claim_renewal_payment: {
        Args: { p_payment_id: string; p_member_id: string; p_reference: string };
        Returns: { ok: true } | { ok: false; code: "VALIDATION" | "NOT_FOUND" | "INVALID_STATE" };
      };
      renewals_due: {
        Args: Record<string, never>;
        Returns: RenewalDueDbRow[];
      };
      // Shapes mirror 008_red_list.sql.
      run_no_show_scan: {
        Args: Record<string, never>;
        Returns: { ok: true; cases_opened: number; followups_due: number; threshold: number };
      };
      red_list: {
        Args: Record<string, never>;
        Returns: RedListDbRow[];
      };
      record_followup: {
        Args: {
          p_case_id: string;
          p_staff_id: string;
          p_channel: FollowUpChannel;
          p_outcome: FollowUpOutcome;
          p_notes: string | null;
          p_next_action_date: string | null;
        };
        Returns: { ok: true; closed: boolean } | { ok: false; code: "FORBIDDEN" | "VALIDATION" | "NOT_FOUND" | "INVALID_STATE" };
      };
    };
    Enums: {
      member_status: MemberStatus;
      membership_status: MembershipStatus;
      attendance_source: AttendanceSource;
      case_status: CaseStatus;
      followup_channel: FollowUpChannel;
      followup_outcome: FollowUpOutcome;
      payment_purpose: PaymentPurpose;
      payment_status: PaymentStatus;
      renewal_order_status: RenewalOrderStatus;
      addon_type: AddonType;
      addon_order_status: AddonOrderStatus;
      notification_template: NotificationTemplate;
      notification_channel: NotificationChannel;
      notification_status: NotificationStatus;
      staff_role: StaffRole;
    };
    CompositeTypes: Record<string, never>;
  };
};
