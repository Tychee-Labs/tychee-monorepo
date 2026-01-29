"use client";

import { useState } from "react";
import { TrendingUp, Calendar, Filter, Download } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Transaction {
    id: string;
    merchant: string;
    category: string;
    amount: number;
    date: string;
    status: string;
}

export default function SpendsPage() {
    const [transactions] = useState<Transaction[]>([
        { id: "1", merchant: "Starbucks", category: "dining", amount: 450, date: "2026-01-25", status: "completed" },
        { id: "2", merchant: "Uber", category: "travel", amount: 280, date: "2026-01-24", status: "completed" },
        { id: "3", merchant: "Amazon", category: "shopping", amount: 1250, date: "2026-01-23", status: "completed" },
        { id: "4", merchant: "Swiggy", category: "dining", amount: 680, date: "2026-01-22", status: "completed" },
    ]);

    const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const avgTransaction = totalSpent / transactions.length;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold gradient-text">Spends Hub</h1>
                    <p className="text-muted-foreground mt-2">
                        Track your spending patterns and get AI-powered insights
                    </p>
                </div>
                <button className="px-6 py-3 glass rounded-full font-medium hover:bg-white/10 transition-all flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    Export
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="premium-card">
                    <div className="text-sm text-muted-foreground mb-2">Total Spent (This Month)</div>
                    <div className="text-3xl font-bold text-gradient-primary">{formatCurrency(totalSpent)}</div>
                    <div className="mt-2 text-sm text-green-400 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        12% less than last month
                    </div>
                </div>

                <div className="premium-card">
                    <div className="text-sm text-muted-foreground mb-2">Transactions</div>
                    <div className="text-3xl font-bold">{transactions.length}</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                        Avg: {formatCurrency(avgTransaction)}
                    </div>
                </div>

                <div className="premium-card">
                    <div className="text-sm text-muted-foreground mb-2">Top Category</div>
                    <div className="text-3xl font-bold text-gradient-gold">Dining</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                        45% of total spend
                    </div>
                </div>
            </div>

            {/* Category Breakdown */}
            <div className="glass-card">
                <h3 className="text-xl font-bold mb-6">Spending by Category</h3>
                <div className="space-y-4">
                    {['dining', 'travel', 'shopping', 'entertainment'].map((category, idx) => {
                        const percentage = [45, 25, 20, 10][idx];
                        return (
                            <div key={category}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="capitalize font-medium">{category}</span>
                                    <span className="text-sm text-muted-foreground">{percentage}%</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Transaction List */}
            <div className="glass-card">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">Recent Transactions</h3>
                    <button className="px-4 py-2 glass rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-white/10">
                        <Filter className="w-4 h-4" />
                        Filter
                    </button>
                </div>

                <div className="space-y-3">
                    {transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                                    {tx.merchant[0]}
                                </div>
                                <div>
                                    <div className="font-semibold">{tx.merchant}</div>
                                    <div className="text-sm text-muted-foreground capitalize">{tx.category}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold">{formatCurrency(tx.amount)}</div>
                                <div className="text-sm text-muted-foreground">{formatDate(tx.date)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
