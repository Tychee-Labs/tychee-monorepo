import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const monthYear = searchParams.get('monthYear'); // Format: YYYY-MM-01

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Get spend clusters
        const clusters = await sql`
      SELECT category, subcategory, total_spend, transaction_count, avg_transaction, month_year
      FROM spend_clusters
      WHERE user_id = ${userId}
      ${monthYear ? sql`AND month_year = ${monthYear}` : sql``}
      ORDER BY month_year DESC, total_spend DESC
    `;

        // Get individual transactions
        const transactions = await sql`
      SELECT id, amount, category, merchant_name, description, soroban_tx_id, status, created_at
      FROM transactions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 100
    `;

        return NextResponse.json({
            clusters: clusters.rows,
            transactions: transactions.rows,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const {
            userId, cardTokenId, amount, category, merchantName,
            description, sorobanTxId
        } = await request.json();

        // Record transaction
        const result = await sql`
      INSERT INTO transactions (
        user_id, card_token_id, amount, category, merchant_name, 
        description, soroban_tx_id, status
      )
      VALUES (
        ${userId}, ${cardTokenId}, ${amount}, ${category}, ${merchantName},
        ${description}, ${sorobanTxId}, 'completed'
      )
      RETURNING id
    `;

        // Update spend cluster (aggregated data)
        const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
        await sql`
      INSERT INTO spend_clusters (user_id, category, total_spend, transaction_count, month_year)
      VALUES (${userId}, ${category}, ${amount}, 1, ${currentMonth})
      ON CONFLICT (user_id, category, month_year)
      DO UPDATE SET
        total_spend = spend_clusters.total_spend + ${amount},
        transaction_count = spend_clusters.transaction_count + 1,
        avg_transaction = (spend_clusters.total_spend + ${amount}) / (spend_clusters.transaction_count + 1),
        updated_at = NOW()
    `;

        return NextResponse.json({ success: true, transactionId: result.rows[0].id });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
