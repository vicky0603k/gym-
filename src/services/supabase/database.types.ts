/**
 * Hand-authored type stubs matching supabase/migrations/001_tables.sql.
 *
 * This file will be overwritten by:
 *   npx supabase gen types typescript --project-id <id> --schema public
 * once a real Supabase project is connected. Until then the hand-authored
 * types serve as the build-time contract.
 *
 * DO NOT add business logic here — use src/services/ for that.
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

// ─── Row types ──────────────────────────────────────────────────────────────

export interface Member {
  id: string;
  name: string;
  phone: string;
  pin_hash: string;
  status: MemberStatus;
  assigned_trainer_id: string | null;
  weekly_target: number;
  join_date: string; // date string YYYY-MM-DD
  marketing_consent: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Trainer {
  id: string;
  name: string;
  phone: string;
  specialisation: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StaffUser {
  id: string; // same as Supabase Auth user id
  name: string;
  role: StaffRole;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  name: string;
  duration_days: number;
  price: number;
  discount_pct: number;
  benefits: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Membership {
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
}

export interface Attendance {
  id: string;
  member_id: string;
  checkin_at: string; // timestamptz ISO string (UTC)
  source: AttendanceSource;
  qr_session_id: string | null;
  staff_id: string | null;
  correction_reason: string | null;
  created_at: string;
}

export interface NoShowCase {
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
}

export interface FollowUp {
  id: string;
  case_id: string;
  channel: FollowUpChannel;
  outcome: FollowUpOutcome;
  notes: string | null;
  staff_id: string;
  created_at: string;
  next_action_date: string | null;
}

export interface Payment {
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
}

export interface RenewalOrder {
  id: string;
  membership_id: string;
  plan_id: string;
  amount: number;
  discount: number;
  payment_id: string;
  status: RenewalOrderStatus;
  created_at: string;
  updated_at: string;
}

export interface Addon {
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
}

export interface AddonOrder {
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
}

export interface Notification {
  id: string;
  member_id: string;
  template: NotificationTemplate;
  channel: NotificationChannel;
  scheduled_at: string;
  sent_at: string | null;
  status: NotificationStatus;
  created_at: string;
}

export interface Settings {
  id: string; // single row, always id = 1 (UUID)
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
}

export interface AuditLog {
  id: string;
  actor_type: string;
  actor_id: string;
  action: string;
  record_type: string;
  record_id: string;
  summary: string;
  created_at: string;
}

// ─── Supabase Database type (used with createClient) ───────────────────────

export interface Database {
  public: {
    Tables: {
      members: {
        Row: Member;
        Insert: Omit<Member, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Omit<Member, "id" | "created_at">>;
      };
      trainers: {
        Row: Trainer;
        Insert: Omit<Trainer, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Omit<Trainer, "id" | "created_at">>;
      };
      staff_users: {
        Row: StaffUser;
        Insert: Omit<StaffUser, "created_at" | "updated_at">;
        Update: Partial<Omit<StaffUser, "id" | "created_at">>;
      };
      plans: {
        Row: Plan;
        Insert: Omit<Plan, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Omit<Plan, "id" | "created_at">>;
      };
      memberships: {
        Row: Membership;
        Insert: Omit<Membership, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Omit<Membership, "id" | "created_at">>;
      };
      attendance: {
        Row: Attendance;
        Insert: Omit<Attendance, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<Attendance, "id" | "created_at">>;
      };
      no_show_cases: {
        Row: NoShowCase;
        Insert: Omit<NoShowCase, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Omit<NoShowCase, "id" | "created_at">>;
      };
      followups: {
        Row: FollowUp;
        Insert: Omit<FollowUp, "id" | "created_at"> & { id?: string };
        Update: never; // append-only
      };
      payments: {
        Row: Payment;
        Insert: Omit<Payment, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Omit<Payment, "id" | "created_at">>;
      };
      renewal_orders: {
        Row: RenewalOrder;
        Insert: Omit<RenewalOrder, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Omit<RenewalOrder, "id" | "created_at">>;
      };
      addons: {
        Row: Addon;
        Insert: Omit<Addon, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Omit<Addon, "id" | "created_at">>;
      };
      addon_orders: {
        Row: AddonOrder;
        Insert: Omit<AddonOrder, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Omit<AddonOrder, "id" | "created_at">>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<Notification, "id" | "created_at">>;
      };
      settings: {
        Row: Settings;
        Insert: Omit<Settings, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Omit<Settings, "id" | "created_at">>;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<AuditLog, "id" | "created_at"> & { id?: string };
        Update: never; // append-only
      };
    };
  };
}
