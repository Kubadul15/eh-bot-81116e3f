// Odtwarzacz muzyki na stronie rekrutacji: zamienia link do playlisty (Spotify albo YouTube) na adres oficjalnego odtwarzacza do osadzenia.
// Nie hostujemy żadnych nagrań – gra wbudowany odtwarzacz serwisu, więc prawa autorskie i licencje zostają po stronie Spotify/YouTube.
export type MusicEmbed = { src: string; height: number; provider: "spotify" | "youtube" };

const SPOTIFY =
  /^https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(playlist|album|artist|track|show|episode)\/([A-Za-z0-9]{10,30})(?:[/?#].*)?$/;
const YT_HOST = /^https:\/\/(?:www\.|music\.|m\.)?youtube\.com\//;
const ID = /^[A-Za-z0-9_-]{6,64}$/;

export function musicEmbed(url: string): MusicEmbed | null {
  const u = url.trim();
  if (!u) return null;
  const sp = SPOTIFY.exec(u);
  if (sp)
    return {
      provider: "spotify",
      src: `https://open.spotify.com/embed/${sp[1]}/${sp[2]}`,
      height: sp[1] === "track" || sp[1] === "episode" ? 152 : 352,
    };
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:") return null;
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.slice(1);
      const list = parsed.searchParams.get("list");
      if (list && ID.test(list))
        return {
          provider: "youtube",
          height: 315,
          src: `https://www.youtube.com/embed/videoseries?list=${list}`,
        };
      return ID.test(id)
        ? { provider: "youtube", height: 315, src: `https://www.youtube.com/embed/${id}` }
        : null;
    }
    if (YT_HOST.test(`${parsed.protocol}//${parsed.hostname}/`)) {
      const list = parsed.searchParams.get("list");
      if (list && ID.test(list))
        return {
          provider: "youtube",
          height: 315,
          src: `https://www.youtube.com/embed/videoseries?list=${list}`,
        };
      const v = parsed.searchParams.get("v");
      if (v && ID.test(v))
        return { provider: "youtube", height: 315, src: `https://www.youtube.com/embed/${v}` };
    }
  } catch {
    /* zły adres */
  }
  return null;
}
