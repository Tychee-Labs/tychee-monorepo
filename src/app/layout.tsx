import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/lib/auth-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Tychee - Web3 Rewards & Card Tokenization",
    description: "Tokenize your cards, earn rewards, discover local deals - powered by Stellar blockchain",
    keywords: ["card tokenization", "web3 rewards", "stellar", "defi", "payments"],
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className={inter.className}>
                <AuthProvider>
                    <div className="min-h-screen bg-background">
                        <Navigation />
                        <main className="container mx-auto px-4 py-8">
                            {children}
                        </main>
                        <Toaster />
                    </div>
                </AuthProvider>
            </body>
        </html>
    );
}
