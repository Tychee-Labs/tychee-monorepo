import { NextResponse } from 'next/server';
import { query, queryOne, queryRows } from '@/lib/db';

/**
 * Points & Rewards API
 * Handles points balance and reward transactions
 */

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Get user's points balance
        const balance = await queryOne(
            `SELECT total_points, tier, updated_at
             FROM user_points_balance
             WHERE user_id = $1`,
            [userId]
        );

        // Get recent transactions
        const transactions = await queryRows(
            `SELECT id, points, tx_type, description, created_at
             FROM rewards_ledger
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 10`,
            [userId]
        );

        return NextResponse.json({
            balance: balance || { total_points: 0, tier: 'bronze' },
            transactions,
        });
    } catch (error: any) {
        console.error('Error fetching points:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { userId, points, txType, description } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Add points transaction
        await query(
            `INSERT INTO rewards_ledger (user_id, points, tx_type, description)
             VALUES ($1, $2, $3, $4)`,
            [userId, points, txType, description]
        );

        // Update user balance with tier calculation
        await query(
            `INSERT INTO user_points_balance (user_id, total_points, tier)
             VALUES ($1, $2, 'bronze')
             ON CONFLICT (user_id)
             DO UPDATE SET
                total_points = user_points_balance.total_points + $2,
                tier = CASE
                    WHEN user_points_balance.total_points + $2 >= 25000 THEN 'platinum'
                    WHEN user_points_balance.total_points + $2 >= 10000 THEN 'gold'
                    WHEN user_points_balance.total_points + $2 >= 5000 THEN 'silver'
                    ELSE 'bronze'
                END,
                updated_at = NOW()`,
            [userId, points]
        );

        return NextResponse.json({ success: true, message: 'Points added successfully' });
    } catch (error: any) {
        console.error('Error updating points:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
