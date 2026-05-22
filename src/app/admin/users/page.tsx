"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminUsersPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/users/customers?channel=all");
  }, [router]);

  return null;
}
