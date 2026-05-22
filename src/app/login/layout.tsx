import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Login to your Nan Peng You Hotpot account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
