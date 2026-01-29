"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, TrendingUp, Gift, Store, Ticket, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
    { name: "Cards", href: "/cards", icon: CreditCard },
    { name: "Spends", href: "/spends", icon: TrendingUp },
    { name: "Rewards", href: "/rewards", icon: Gift },
    { name: "Store", href: "/store", icon: Store },
    { name: "Vouchers", href: "/vouchers", icon: Ticket },
    { name: "Partners", href: "/partners", icon: Users },
];

export function Navigation() {
    const pathname = usePathname();

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
                        {navigation.map((item) => {
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

                    <button className="px-4 py-2 bg-gradient-to-r from-primary to-accent rounded-full text-white font-medium hover:shadow-glow transition-all flex items-center gap-2">
                        <Wallet className="w-4 h-4" />
                        Connect Wallet
                    </button>
                </div>

                {/* Mobile Navigation */}
                <div className="md:hidden flex overflow-x-auto py-2 gap-2 no-scrollbar">
                    {navigation.map((item) => {
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
