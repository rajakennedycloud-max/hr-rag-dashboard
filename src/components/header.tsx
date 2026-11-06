"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { LogOut, LayoutDashboard } from "lucide-react";
import type { UserSession } from "@/types";

const ROLE_LABELS: Record<string, string> = {
  TA_SPECIALIST: "TA Specialist",
  BUSINESS_HEAD: "Business Head",
  ADMIN: "Admin",
};

export default function Header({ session }: { session: UserSession | null }) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <LayoutDashboard className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <span className="font-semibold text-gray-900 text-sm">HR RAG Dashboard</span>
              <span className="hidden sm:inline text-xs text-gray-400 ml-2">Offer-drop risk tracking</span>
            </div>
          </Link>

          {session && (
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900 leading-tight">{session.name}</p>
                <p className="text-xs text-gray-500">
                  {ROLE_LABELS[session.role] ?? session.role}
                  {session.sector ? ` · ${session.sector}` : ""}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-sm font-semibold text-brand-700">
                {session.name?.charAt(0).toUpperCase() ?? "?"}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
