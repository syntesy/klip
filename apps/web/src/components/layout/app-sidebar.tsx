"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { clsx } from "clsx";

const navItems = [
  { href: "/communities", label: "Comunidades", icon: "⊞" },
  { href: "/klips", label: "Meus Klips", icon: "◆" },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 flex flex-col bg-sidebar-bg border-r border-gray-200/60 h-full shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-200/60">
        <Link href="/communities" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue flex items-center justify-center">
            <span className="text-white text-xs font-bold">K</span>
          </div>
          <span className="font-semibold text-text-1 text-sm">Klip</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              pathname.startsWith(item.href)
                ? "bg-blue text-white"
                : "text-text-2 hover:bg-gray-200/60 hover:text-text-1"
            )}
          >
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-200/60">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-8 h-8",
            },
          }}
        />
      </div>
    </aside>
  );
}
