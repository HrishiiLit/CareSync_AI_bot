import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import ThreeShim from '@/components/threeShim/ThreeShim';
import LocalAuthProviderWrapper from "./providers/LocalAuthProviderWrapper";
import "./globals.css";

export const metadata = {
  title: "CareSync AI",
  description: "Clinical Automation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <LocalAuthProviderWrapper>
          <ThreeShim />
          <Navbar />
          <main className="pt-20">{children}</main>
          <Footer />
        </LocalAuthProviderWrapper>
      </body>
    </html>
  );
}
