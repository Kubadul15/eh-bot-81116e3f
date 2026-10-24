// Typy współdzielone przez panel administratora (UI) i funkcje serwerowe. Bez zależności serwerowych.
import type { Limits, Payment, PremiumGrant } from "./premium";

export type ServerRow = {
  id: string;
  name: string;
  icon: string | null;
  botIn: boolean;
  configured: boolean;
  premium: { active: boolean; lifetime: boolean; until: string | null };
  blocked: string | null;
  disabled: number;
  note: string;
  tags: string[];
  updatedAt: string | null;
  updatedBy: string | null;
};

export type ServerDetail = ServerRow & {
  ownerId: string | null;
  members: number | null;
  contact: string;
  payments: Payment[];
  grant: PremiumGrant | null;
  limits: Partial<Limits>;
  effectiveLimits: Limits;
  disabledModules: string[];
  channelsSet: number;
  rolesSet: number;
  pendingPanels: string[];
  blockedInfo: { reason: string; at: string; by: string } | null;
};

export type AuditEntry = {
  at: string;
  by: string;
  action: string;
  guild: string | null;
  details: string;
};
export type DiscountCode = {
  code: string;
  percent: number;
  maxUses: number | null;
  used: number;
  note: string;
  createdAt: string;
  expiresAt: string | null;
};
export type Notice = {
  text: string;
  level: "info" | "warn" | "danger";
  until: string | null;
  at: string;
};
export type SessionRow = {
  id: string;
  userId: string;
  username: string;
  createdAt: string;
  expiresAt: string;
  mine: boolean;
};

export type Overview = {
  botGuilds: number;
  configured: number;
  premiumActive: number;
  lifetime: number;
  timed: number;
  free: number;
  blocked: number;
  revenueTotal: number;
  revenueMonth: number;
  monthly: { month: string; total: number }[];
  expiringSoon: ServerRow[];
  recent: AuditEntry[];
  sessions: number;
  maintenance: boolean;
  notice: Notice | null;
};

export type DiagnoseReport = {
  guildName: string;
  botIn: boolean;
  permissions: { name: string; ok: boolean }[];
  missingChannels: { key: string; id: string; reason: string }[];
  missingRoles: { key: string; id: string }[];
  okChannels: number;
  okRoles: number;
};

export type PublicNotice = { notice: Notice | null; maintenance: boolean };
