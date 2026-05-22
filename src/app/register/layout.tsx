import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register",
  description: "Create a Nan Peng You Hotpot account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RegisterLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
