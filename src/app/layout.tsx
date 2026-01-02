import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "./ClientLayout";
import ConditionalBackground from "@/components/ConditionalBackground";

export const metadata: Metadata = {
  title: "Mesa+",
  description: "O melhor software para restaurantes!",
  icons: {
    icon: "/logo-icon.svg",
    shortcut: "/logo-icon.svg",
    apple: "/logo-icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <body className="antialiased font-sans" suppressHydrationWarning={true}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
