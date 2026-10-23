import type { FollowUpChannel, FollowUpOutcome } from "@/services/supabase/database.types";

/** Plain-language labels for follow-up outcomes, in the order staff see them. */
export const OUTCOME_LABELS: Record<FollowUpOutcome, string> = {
  WillReturn: "Will come back",
  Injured: "Injured or unwell",
  Travelling: "Travelling",
  TimingIssue: "Timing doesn't suit",
  Unhappy: "Unhappy with the gym",
  NoResponse: "No response",
  Cancelled: "Wants to cancel — close case",
};

export const CHANNEL_LABELS: Record<FollowUpChannel, string> = {
  Call: "Call",
  WhatsApp: "WhatsApp",
  InPerson: "In person",
};
