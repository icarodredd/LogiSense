"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode, MouseEvent } from "react";
import { api } from "../lib/api";

type PlatformEntryLinkProps = {
  children: ReactNode;
  className?: string;
};

export function PlatformEntryLink({ children, className }: PlatformEntryLinkProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function enter(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await api.me();
      router.push("/dashboard");
    } catch {
      router.push("/login");
    }
  }

  return (
    <Link href="/login" className={className} onClick={enter} aria-disabled={loading}>
      {loading ? "Verificando acesso..." : children}
    </Link>
  );
}
