"use client";

import { useState, useEffect, useCallback } from "react";
import { Gift, Star, Zap, Trophy, ArrowRight, Loader2, LogIn } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface RewardItem {
    id: string;
    title: string;
    points: number;
    type: string;
}

export default function RewardsPage() {
    const { user, isLoading: authLoading, login } = useAuth();
    const [userPoints, setUserPoints] = useState(0);
    const [userTier, setUserTier] = useState("bronze");
    const [isLoading, setIsLoading] = useState(false);
    const [isRedeeming, setIsRedeeming] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const tiers = [
        { name: "Bronze", min: 0, color: "from-orange-600 to-orange-400" },
        { name: "Silver", min: 5000, color: "from-gray-400 to-gray-200" },
        { name: "Gold", min: 10000, color: "from-yellow-500 to-yellow-300" },
        { name: "Platinum", min: 25000, color: "from-purple-500 to-pink-400" },
    ];

    const rewards: RewardItem[] = [
        { id: "1", title: "₹500 Off on Dining", points: 5000, type: "voucher" },
        { id: "2", title: "2x Points Weekend", points: 2000, type: "boost" },
        { id: "3", title: "Free Movie Ticket", points: 8000, type: "voucher" },
        { id: "4", title: "Exclusive Gold Lounge", points: 15000, type: "experience" },
    ];

    // Fetch points balance
    const fetchPoints = useCallback(async () => {
        if (!user?.id) return;

        setIsLoading(true);
        try {
            const response = await fetch(`/api/points?userId=${user.id}`);
            const data = await response.json();

            if (data.balance) {
                setUserPoints(data.balance.total_points || 0);
                setUserTier(data.balance.tier || 'bronze');
            }
        } catch (err) {
            console.error('Failed to fetch points:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        if (user?.id) {
            fetchPoints();
        }
    }, [user?.id, fetchPoints]);

    // Calculate points to next tier
    const getPointsToNextTier = () => {
        const currentTierIndex = tiers.findIndex(t => t.name.toLowerCase() === userTier);
        if (currentTierIndex < tiers.length - 1) {
            const nextTier = tiers[currentTierIndex + 1];
            return nextTier.min - userPoints;
        }
        return 0;
    };

    // Redeem reward
    const handleRedeem = async (reward: RewardItem) => {
        if (!user?.id || userPoints < reward.points) return;

        setIsRedeeming(reward.id);
        setError(null);
        setSuccess(null);

        try {
            // Deduct points
            const response = await fetch('/api/points', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    points: -reward.points,
                    txType: 'redeem',
                    description: `Redeemed: ${reward.title}`
                })
            });

            if (!response.ok) {
                throw new Error('Failed to redeem reward');
            }

            setSuccess(`Successfully redeemed "${reward.title}"!`);
            fetchPoints();

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsRedeeming(null);
        }
    };

    // If not logged in
    if (!user && !authLoading) {
        return (
            <div className="space-y-8">
                <div className="text-center py-16">
                    <Gift className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h2 className="text-2xl font-bold mb-4">Connect to View Rewards</h2>
                    <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                        Create a wallet to start earning and redeeming rewards.
                    </p>
                    <button
                        onClick={login}
                        className="px-8 py-4 bg-gradient-to-r from-primary to-accent rounded-full text-white font-semibold hover:shadow-glow transition-all flex items-center gap-2 mx-auto"
                    >
                        <LogIn className="w-5 h-5" />
                        Connect Wallet
                    </button>
                </div>
            </div>
        );
    }

    if (authLoading || isLoading) {
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
                <h1 className="text-4xl font-bold gradient-text">Rewards</h1>
                <p className="text-muted-foreground mt-2">
                    Earn points, climb tiers, and unlock exclusive benefits
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

            {/* Points Balance Card */}
            <div className="relative overflow-hidden rounded-3xl p-8 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500">
                <div className="relative z-10">
                    <div className="text-white/80 text-sm font-medium mb-2">Your Balance</div>
                    <div className="text-white text-6xl font-bold mb-4">{formatNumber(userPoints)}</div>
                    <div className="flex items-center gap-2">
                        <div className={`px-4 py-2 rounded-full bg-gradient-to-r ${tiers.find(t => t.name.toLowerCase() === userTier)?.color} text-white font-bold text-sm`}>
                            {userTier.toUpperCase()} TIER
                        </div>
                        {getPointsToNextTier() > 0 && (
                            <div className="text-white/80 text-sm">
                                {formatNumber(getPointsToNextTier())} points to {tiers[tiers.findIndex(t => t.name.toLowerCase() === userTier) + 1]?.name}
                            </div>
                        )}
                    </div>
                </div>

                {/* Decorative background */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-2xl" />
            </div>

            {/* Tier Progress */}
            <div className="glass-card">
                <h3 className="text-xl font-bold mb-6">Tier Progress</h3>
                <div className="space-y-6">
                    {tiers.map((tier, idx) => {
                        const isUnlocked = userPoints >= tier.min;
                        const isCurrent = tier.name.toLowerCase() === userTier;
                        return (
                            <div key={tier.name} className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${isUnlocked
                                    ? `bg-gradient-to-br ${tier.color} text-white`
                                    : 'bg-muted text-muted-foreground'
                                    }`}>
                                    {isUnlocked ? '✓' : idx + 1}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-semibold">{tier.name}</span>
                                        <span className="text-sm text-muted-foreground">{formatNumber(tier.min)} pts</span>
                                    </div>
                                    {isCurrent && (
                                        <div className="text-xs text-accent flex items-center gap-1">
                                            <Star className="w-3 h-3 fill-current" />
                                            Current Tier
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Rewards Catalog */}
            <div className="space-y-6">
                <h2 className="text-2xl font-bold">Redeem Rewards</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {rewards.map((reward) => {
                        const canRedeem = userPoints >= reward.points;
                        const isThisRedeeming = isRedeeming === reward.id;

                        return (
                            <div key={reward.id} className="premium-card">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                                        <Gift className="w-7 h-7 text-white" />
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${canRedeem ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'
                                        }`}>
                                        {formatNumber(reward.points)} pts
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold mb-2">{reward.title}</h3>
                                <p className="text-sm text-muted-foreground mb-4 capitalize">{reward.type}</p>

                                <button
                                    onClick={() => handleRedeem(reward)}
                                    disabled={!canRedeem || isThisRedeeming}
                                    className={`w-full px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${canRedeem
                                        ? 'bg-gradient-to-r from-primary to-accent text-white hover:shadow-glow'
                                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                                        }`}
                                >
                                    {isThisRedeeming ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            Redeem
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Earn More Section */}
            <div className="glass-card border-accent/30">
                <div className="flex items-start gap-4">
                    <Zap className="w-12 h-12 text-accent flex-shrink-0" />
                    <div>
                        <h3 className="font-bold text-lg mb-2">Earn 2x Points This Weekend!</h3>
                        <p className="text-sm text-muted-foreground">
                            Use your tokenized cards for any transaction from Friday to Sunday and earn double rewards points.
                        </p>
                        <button className="mt-4 px-6 py-2 bg-accent rounded-full text-white font-medium hover:shadow-glow-green transition-all">
                            Learn More
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
