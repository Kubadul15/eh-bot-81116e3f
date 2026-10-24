import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ChannelField, RolePicker } from "@/components/config-ui";
import type { RoleField } from "@/lib/bot-slots";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roles = [
  { id: "1", name: "Admin", color: 0xff0000 },
  { id: "2", name: "Moderator", color: 0x00ff00 },
  { id: "3", name: "Gracz", color: 0 },
];

let host: HTMLDivElement;
let root: Root;
beforeAll(() => {
  document.body.innerHTML = "";
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function mount(node: React.ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(node));
}
const buttons = (pressed: "true" | "false") => [
  ...host.querySelectorAll<HTMLButtonElement>(`button[aria-pressed="${pressed}"]`),
];
const byName = (pressed: "true" | "false", name: string) =>
  buttons(pressed).find((b) => b.textContent?.includes(name))!;
const click = (el: HTMLElement) =>
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

function Harness({ field }: { field: RoleField }) {
  const [sel, setSel] = useState<string[]>([]);
  return (
    <RolePicker
      field={field}
      roles={roles}
      selected={sel}
      onToggle={(id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
    />
  );
}

describe("RolePicker", () => {
  const field: RoleField = { key: "staff", label: "Administracja", desc: "opis", multi: true };

  it("pokazuje wyraźną różnicę między wybraną a niewybraną rangą", () => {
    mount(<Harness field={field} />);
    expect(host.textContent).toContain("Nie wybrano");
    expect(buttons("false")).toHaveLength(3);
    expect(buttons("true")).toHaveLength(0);

    click(byName("false", "Moderator"));

    expect(host.textContent).toContain("Wybrano: 1");
    expect(buttons("true")).toHaveLength(1);
    expect(buttons("true")[0]!.textContent).toContain("Moderator");
    expect(buttons("true")[0]!.className).toContain("bg-emerald-600"); // zielone tło = zaznaczone
    expect(buttons("false")).toHaveLength(2);
    expect(buttons("false").every((b) => !b.className.includes("bg-emerald-600"))).toBe(true);
  });

  it("odznacza rangę po ponownym kliknięciu", () => {
    mount(<Harness field={field} />);
    click(byName("false", "Admin"));
    click(byName("true", "Admin"));
    expect(host.textContent).toContain("Nie wybrano");
    expect(buttons("true")).toHaveLength(0);
  });

  it("numeruje rangi w drabince w kolejności klikania", () => {
    mount(<Harness field={{ ...field, key: "ranks", ordered: true }} />);
    click(byName("false", "Gracz"));
    click(byName("false", "Admin"));
    const on = buttons("true");
    expect(on[0]!.textContent).toContain("1.");
    expect(on[0]!.textContent).toContain("Gracz");
    expect(on[1]!.textContent).toContain("2.");
    expect(on[1]!.textContent).toContain("Admin");
  });
});

describe("ChannelField", () => {
  const slot: [string, string, string, string] = ["panel", "🏛️", "Panel Urzędu", "opis"];
  const options = [{ id: "10", name: "urzad", type: 0 }];

  it("pokazuje status Ustawiono / Nie ustawiono", () => {
    mount(<ChannelField slot={slot} value="" options={options} onChange={() => {}} />);
    expect(host.textContent).toContain("Nie ustawiono");
    act(() =>
      root.render(<ChannelField slot={slot} value="10" options={options} onChange={() => {}} />),
    );
    expect(host.textContent).toContain("Ustawiono");
    expect(host.textContent).not.toContain("Nie ustawiono Panel");
  });
});
