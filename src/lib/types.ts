export type Side = "pro" | "con";

export const STATUSES = [
  "active",
  "answered",
  "dropped",
  "extended",
  "turned",
  "unresolved",
] as const;
export type Status = (typeof STATUSES)[number];

export interface Speech {
  id: string;
  name: string;
  side: Side;
  minutes: number;
}

export interface Round {
  id: string;
  title: string;
  tournament: string;
  /** The side the user is flowing for. */
  side: Side;
  opponent: string;
  partner: string;
  speeches: Speech[];
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  /** Speech-prep plans and review notes. All user-authored. */
  plans?: Plans;
  review?: Review;
  completed?: boolean;
}

export const WEIGH_MECHANISMS = ["magnitude", "probability", "timeframe", "scope", "reversibility", "structural"] as const;
export type WeighMechanism = (typeof WEIGH_MECHANISMS)[number];
export interface WeighEntry { id: string; mechanism: WeighMechanism; text: string }
export interface PlanItem {
  id: string;
  argId: string;
  offense: boolean;
  needsDefense: boolean;
  voting: boolean;
  responseIds: string[];
  extraCardIds: string[];
  weighing: WeighEntry[];
  opposingIds: string[];
  comparison: string;
  note: string;
}
export interface SpeechPlan { items: PlanItem[]; weighingNotes: string; narrative: string; impactCalculus: string }
export interface Plans { summary: SpeechPlan; finalFocus: SpeechPlan }
export interface Review {
  judge: string; ballot: string; rfd: string; judgeFeedback: string;
  opponentStrategy: string; observations: string;
  /** Entered by the user; never computed. */
  result: "" | "win" | "loss";
}
export const emptyPlan = (): SpeechPlan => ({ items: [], weighingNotes: "", narrative: "", impactCalculus: "" });
export const emptyReview = (): Review => ({ judge: "", ballot: "", rfd: "", judgeFeedback: "", opponentStrategy: "", observations: "", result: "" });

/**
 * One cell on the flow. Relationships are explicit:
 *  - parentId: the argument this one responds to / sits under (tree edge)
 *  - extendsId: this node extends an earlier argument into a later speech
 *  - linkedIds: free cross-links to arguments elsewhere in the flow
 * All status values are set manually by the user.
 */
export interface Arg {
  id: string;
  roundId: string;
  /** Whose case (contention tree) this belongs to. */
  flow: Side;
  speechId: string;
  parentId: string | null;
  /** Fractional index among siblings. */
  order: number;
  /** Sanitised inline HTML (b, i, s, mark, br). */
  text: string;
  status: Status;
  priority: 0 | 1 | 2 | 3;
  tags: string[];
  notes: string;
  impact: string;
  collapsed: boolean;
  isTurn: boolean;
  extendsId: string | null;
  linkedIds: string[];
  evidenceIds: string[];
  /** Library material inserted into this argument (snapshots that keep a link to their source). */
  inserts: Insert[];
  createdAt: number;
  updatedAt: number;
}

export interface InsertEntry {
  id: string;
  /** Source library card, if any (kept so the original can be opened / refreshed). */
  cardId: string | null;
  tag: string;
  citation: string;
  /** Snapshot HTML with formatting + highlighting preserved. */
  html: string;
  kind: "card" | "text";
}
export interface Insert {
  id: string;
  /** Source block, if inserted from the block library. */
  blockId: string | null;
  name: string;
  entries: InsertEntry[];
  at: number;
}

export type ArgMap = Record<string, Arg>;

export const PF_SPEECHES: Omit<Speech, "id">[] = [
  { name: "Pro Constructive", side: "pro", minutes: 4 },
  { name: "Con Constructive", side: "con", minutes: 4 },
  { name: "Pro Rebuttal", side: "pro", minutes: 4 },
  { name: "Con Rebuttal", side: "con", minutes: 4 },
  { name: "Pro Summary", side: "pro", minutes: 3 },
  { name: "Con Summary", side: "con", minutes: 3 },
  { name: "Pro Final Focus", side: "pro", minutes: 2 },
  { name: "Con Final Focus", side: "con", minutes: 2 },
];
