// Typy danych strony rekrutacyjnej współdzielone między serwerem a widokami (bez kodu serwerowego).
import type { AppStatus, StaffLevel } from "./recruit-logic";
import type { RecruitSiteConfig } from "./content-config";

export type PublicRecruit =
  | { state: "unavailable" }
  | {
      state: "ok";
      guild: { id: string; name: string; icon: string | null };
      site: Omit<RecruitSiteConfig, "enabled">;
      open: boolean;
      positions: { id: string; label: string; emoji: string; desc: string; open: boolean }[];
      questions: {
        id: string;
        label: string;
        style: "short" | "long";
        required: boolean;
        placeholder: string;
      }[];
    };

export type AppRow = {
  id: string;
  positionId: string;
  positionLabel: string;
  discordNick: string;
  discordId: string | null;
  robloxNick: string;
  age: number;
  answers: { id: string; q: string; a: string; s?: "short" | "long" }[];
  autoScore: number;
  flags: string[];
  tabSwitches: number;
  status: AppStatus;
  note: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};
export type StaffRow = {
  userId: string;
  username: string;
  level: StaffLevel;
  addedBy: string | null;
  createdAt: string;
};

export type RecruitPanel =
  | { state: "login" }
  | { state: "forbidden"; user: { id: string; username: string } }
  | { state: "unavailable"; guildName: string; reason: string }
  | {
      state: "ok";
      level: StaffLevel | "manage";
      user: { id: string; username: string; avatar: string | null };
      guild: { id: string; name: string; icon: string | null };
      apps: AppRow[];
      staff: StaffRow[];
      positions: { id: string; label: string; roleId: string }[];
      siteEnabled: boolean;
      minChars: number;
    };
