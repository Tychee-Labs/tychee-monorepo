import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Get user's points balance
        const balance = await sql`
      SELECT total_points, tier, updated_at
      FROM user_points_balance
      WHERE user_id = ${userId}
    `;

        // Get recent transactions
        const transactions = await sql`
      SELECT id, points, tx_type, description, created_at
      FROM rewards_ledger
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 10
    `;

        return NextResponse.json({
            balance: balance.rows[0] || { total_points: 0, tier: 'bronze' },
            transactions: transactions.rows,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { userId, points, txType, description } = await request.json();

        // Add points transaction
        await sql`
      INSERT INTO rewards_ledger (user_id, points, tx_type, description)
      VALUES (${userId}, ${points}, ${txType}, ${description})
    `;

        // Update user balance
        await sql`
      INSERT INTO user_points_balance (user_id, total_points, tier)
      VALUES (${userId}, ${points}, 'bronze')
      ON CONFLICT (user_id)
      DO UPDATE SET
        total_points = user_points_balance.total_points + ${points},
        tier = CASE
          WHEN user_points_balance.total_points + ${points} >= 25000 THEN 'platinum'
          WHEN user_points_balance.total_points + ${points} >= 10000 THEN 'gold'
          WHEN user_points_balance.total_points + ${points} >= 5000 THEN 'silver'
          ELSE 'bronze'
        END,
        updated_at = NOW()
    `;

        return NextResponse.json({ success: true, message: 'Points added successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
