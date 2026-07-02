export type NavItem = {
  href: string;
  label: string;
};

export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/app", label: "Copilot" },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
