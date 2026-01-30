"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, TrendingUp, Gift, Store, Ticket, Users, Wallet, LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const navItems = [
    { name: "Cards", href: "/cards", icon: CreditCard },
    { name: "Spends", href: "/spends", icon: TrendingUp },
    { name: "Rewards", href: "/rewards", icon: Gift },
    { name: "Store", href: "/store", icon: Store },
    { name: "Vouchers", href: "/vouchers", icon: Ticket },
    { name: "Partners", href: "/partners", icon: Users },
];

export function Navigation() {
    const pathname = usePathname();
    const { user, isLoading, login, logout, walletAddress } = useAuth();

    return (
        <nav className="sticky top-0 z-40 w-full border-b border-border/40 glass backdrop-blur-lg">
            <div className="container mx-auto px-4">
                <div className="flex h-16 items-center justify-between">
                    <Link href="/" className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                            <span className="text-white font-bold text-lg">T</span>
                        </div>
                        <span className="text-xl font-bold gradient-text">Tychee</span>
                    </Link>

                    <div className="hidden md:flex items-center space-x-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                                        isActive
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </div>

                    {/* Wallet Button */}
                    {isLoading ? (
                        <div className="px-4 py-2 rounded-full bg-muted flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Loading...</span>
                        </div>
                    ) : user ? (
                        <div className="flex items-center gap-2">
                            <div className="hidden sm:flex flex-col items-end text-right">
                                <span className="text-xs text-muted-foreground">Connected</span>
                                <span className="text-xs font-mono">
                                    {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                                </span>
                            </div>
                            <button
                                onClick={logout}
                                className="p-2 rounded-full bg-muted hover:bg-destructive/20 transition-colors"
                                title="Disconnect"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={login}
                            className="px-4 py-2 bg-gradient-to-r from-primary to-accent rounded-full text-white font-medium hover:shadow-glow transition-all flex items-center gap-2"
                        >
                            <Wallet className="w-4 h-4" />
                            Connect Wallet
                        </button>
                    )}
                </div>

                {/* Mobile Navigation */}
                <div className="md:hidden flex overflow-x-auto py-2 gap-2 no-scrollbar">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap",
                                    isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground bg-muted"
                                )}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {item.name}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
