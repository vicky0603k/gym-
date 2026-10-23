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
  created_at: string;
  updated_at: string;
};

export type RenewalOrder = {
  id: string;
  membership_id: string;
  plan_id: string;
  amount: number;
  discount: number;
  payment_id: string;
  status: RenewalOrderStatus;
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

// ─── Supabase Database type (used with createClient) ───────────────────────

export type Database = {
  public: {
    Tables: {
      members: {
        Row: Member;
        Insert: Omit<
          Member,
          "id" | "created_at" | "updated_at" | "pin_hash" | "assigned_trainer_id" | "notes" | "status" | "weekly_target" | "join_date" | "marketing_consent"
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
        Insert: Omit<StaffUser, "created_at" | "updated_at" | "role"> & {
          role?: StaffRole;
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
          "id" | "created_at" | "updated_at" | "provider_ref" | "verified_by" | "verified_at" | "status"
        > & {
          id?: string;
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
          "id" | "created_at" | "updated_at" | "discount" | "status"
        > & {
          id?: string;
          discount?: number;
          status?: RenewalOrderStatus;
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
          "id" | "created_at" | "updated_at" | "logo_url" | "address" | "phone" | "gym_name" | "timezone" | "no_show_threshold_days" | "qr_rotation_seconds" | "duplicate_window_hours" | "renewal_windows" | "weekly_goal_default"
        > & {
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
        };
        Update: Partial<Omit<Settings, "id" | "created_at">>;
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
    Functions: Record<string, never>;
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
