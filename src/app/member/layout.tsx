import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { ProfileCompletionGate } from "@/components/profile-completion-gate";

export const metadata: Metadata = {
  title: "Member Area",
  description: "Member account area for Nan Peng You Hotpot customers.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function MemberLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light text-slate-900 dark:bg-background-dark dark:text-slate-100">
      <Navbar />
      <ProfileCompletionGate>
        <main className="flex-1 pb-10">{children}</main>
      </ProfileCompletionGate>
    </div>
  );
}
