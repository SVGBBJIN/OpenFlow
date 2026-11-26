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
}

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
  createdAt: number;
  updatedAt: number;
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
