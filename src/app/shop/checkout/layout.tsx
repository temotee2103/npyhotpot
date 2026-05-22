import type { Metadata } from "next";
import { ProfileCompletionGate } from "@/components/profile-completion-gate";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function ShopCheckoutLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ProfileCompletionGate>{children}</ProfileCompletionGate>;
}
