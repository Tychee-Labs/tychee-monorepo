"use client";

import { useState, useEffect, useCallback } from "react";
import { Ticket, Copy, Check, AlertCircle, Loader2, LogIn } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface Voucher {
    id: string;
    code: string;
    title: string;
    description: string;
    discount_value: number;
    discount_type: "percent" | "fixed";
    min_purchase: number;
    valid_until: string;
    partner_id?: string;
    used: boolean;
    soroban_voucher_id?: string;
}

export default function VouchersPage() {
    const { user, isLoading: authLoading, login } = useAuth();
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [isRedeeming, setIsRedeeming] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Fetch vouchers
    const fetchVouchers = useCallback(async () => {
        setIsLoading(true);
        try {
            const url = user?.id
                ? `/api/vouchers?userId=${user.id}`
                : '/api/vouchers';
            const response = await fetch(url);
            const data = await response.json();

            if (data.vouchers) {
                setVouchers(data.vouchers);
            }
        } catch (err) {
            console.error('Failed to fetch vouchers:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchVouchers();
    }, [fetchVouchers]);

    const handleCopy = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const handleRedeem = async (voucher: Voucher) => {
        if (!user?.id || voucher.used) return;

        setIsRedeeming(voucher.id);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/vouchers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    voucherId: voucher.id,
                    userId: user.id
                })
            });

            if (!response.ok) {
                throw new Error('Failed to redeem voucher');
            }

            setSuccess(`Successfully redeemed "${voucher.title}"!`);
            fetchVouchers();

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsRedeeming(null);
        }
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-bold gradient-text">Vouchers</h1>
                <p className="text-muted-foreground mt-2">
                    Blockchain-verified vouchers you can claim, trade, and redeem
                </p>
            </div>

            {/* Status Messages */}
            {error && (
                <div className="p-4 bg-destructive/20 border border-destructive rounded-lg text-destructive">
                    {error}
                </div>
            )}
            {success && (
                <div className="p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400">
                    {success}
                </div>
            )}

            {/* Info Banner */}
            <div className="glass-card border-accent/30">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg">On-Chain Vouchers</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            All vouchers are tokenized on Stellar blockchain. They're transferable, verifiable, and cannot be duplicated.
                        </p>
                    </div>
                </div>
            </div>

            {/* Login prompt if not logged in */}
            {!user && (
                <div className="text-center py-8 glass-card">
                    <Ticket className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-bold mb-2">Connect to Claim Vouchers</h3>
                    <p className="text-muted-foreground mb-4">
                        Create a wallet to claim and redeem vouchers.
                    </p>
                    <button
                        onClick={login}
                        className="px-6 py-3 bg-gradient-to-r from-primary to-accent rounded-full text-white font-semibold hover:shadow-glow transition-all flex items-center gap-2 mx-auto"
                    >
                        <LogIn className="w-5 h-5" />
                        Connect Wallet
                    </button>
                </div>
            )}

            {/* Vouchers Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
            ) : vouchers.length === 0 ? (
                <div className="text-center py-12 glass-card">
                    <Ticket className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-bold mb-2">No Vouchers Available</h3>
                    <p className="text-muted-foreground">
                        Check back later for new vouchers and deals!
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {vouchers.map((voucher) => {
                        const isExpiringSoon = new Date(voucher.valid_until) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                        const isThisRedeeming = isRedeeming === voucher.id;

                        return (
                            <div key={voucher.id} className={`voucher-ticket ${voucher.used ? 'opacity-60' : ''}`}>
                                {/* Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-xl mb-1">{voucher.title}</h3>
                                        <p className="text-sm text-muted-foreground">{voucher.description}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                                        <Ticket className="w-6 h-6 text-white" />
                                    </div>
                                </div>

                                {/* Blockchain verification badge */}
                                {voucher.soroban_voucher_id && (
                                    <div className="text-xs text-accent mb-4 flex items-center gap-1">
                                        <Check className="w-3 h-3" />
                                        Verified on Stellar
                                    </div>
                                )}

                                {/* Discount Value */}
                                <div className="mb-6">
                                    <div className="text-4xl font-bold text-gradient-primary">
                                        {voucher.discount_type === "percent"
                                            ? `${voucher.discount_value}% OFF`
                                            : formatCurrency(voucher.discount_value)
                                        }
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                        Min. purchase: {formatCurrency(voucher.min_purchase)}
                                    </div>
                                </div>

                                {/* Code */}
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border-2 border-dashed border-border">
                                        <code className="flex-1 font-mono font-bold text-lg">{voucher.code}</code>
                                        <button
                                            onClick={() => handleCopy(voucher.code)}
                                            disabled={voucher.used}
                                            className="p-2 hover:bg-background rounded transition-colors"
                                        >
                                            {copiedCode === voucher.code ? (
                                                <Check className="w-5 h-5 text-green-400" />
                                            ) : (
                                                <Copy className="w-5 h-5" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Status & Expiry */}
                                <div className="flex items-center justify-between text-sm">
                                    <div className={`px-3 py-1 rounded-full font-medium ${voucher.used
                                        ? 'bg-muted text-muted-foreground'
                                        : isExpiringSoon
                                            ? 'bg-destructive/20 text-destructive'
                                            : 'bg-green-500/20 text-green-400'
                                        }`}>
                                        {voucher.used ? 'Used' : isExpiringSoon ? 'Expiring Soon' : 'Active'}
                                    </div>
                                    <div className="text-muted-foreground">
                                        Valid until {formatDate(voucher.valid_until)}
                                    </div>
                                </div>

                                {!voucher.used && user && (
                                    <button
                                        onClick={() => handleRedeem(voucher)}
                                        disabled={isThisRedeeming}
                                        className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-primary to-accent rounded-lg text-white font-medium hover:shadow-glow transition-all flex items-center justify-center gap-2"
                                    >
                                        {isThisRedeeming ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            'Redeem Now'
                                        )}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Claim More Section */}
            <div className="text-center glass-card">
                <Ticket className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-bold mb-2">Want More Vouchers?</h3>
                <p className="text-muted-foreground mb-6">
                    Earn points through transactions and redeem them for exclusive vouchers
                </p>
                <a
                    href="/rewards"
                    className="inline-block px-8 py-3 bg-gradient-to-r from-primary to-accent rounded-full text-white font-medium hover:shadow-glow transition-all"
                >
                    Browse Rewards
                </a>
            </div>
        </div>
    );
}
