import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { CursorDot } from "../components/cursor-dot";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { getServerLang } from "../lib/lang.functions";
import { langFromCookie, normLang } from "../lib/i18n";
import { I18nProvider, useI18n } from "../lib/i18n-react";

function NotFoundComponent() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("Nie znaleziono strony")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("Strona, której szukasz, nie istnieje albo została przeniesiona.")}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("Wróć na stronę główną")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const { t } = useI18n();
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("Ta strona się nie załadowała")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "Coś poszło nie tak po naszej stronie. Spróbuj odświeżyć stronę albo wróć na stronę główną.",
          )}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("Spróbuj ponownie")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("Wróć na stronę główną")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // język strony: z ciasteczka (serwer czyta nagłówek, przeglądarka – document.cookie), domyślny ustawia DEFAULT_LANG w lib/i18n.ts
  beforeLoad: async () => ({
    lang: typeof document === "undefined" ? await getServerLang() : langFromCookie(document.cookie),
  }),
  head: ({ match }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Emergency Hamburg Bot" },
      { property: "og:locale", content: normLang(match.context.lang) === "pl" ? "pl_PL" : "en_GB" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#202020" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const lang = normLang(useRouterState({ select: (s) => s.matches[0]?.context?.lang }));
  return (
    <html lang={lang}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient, lang } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider lang={lang}>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <CursorDot />
        <Outlet />
      </I18nProvider>
    </QueryClientProvider>
  );
}
