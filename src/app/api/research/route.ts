import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

/**
 * AI-Generated Research API
 * Generates insights based on spending patterns using simple heuristics
 * In production, integrate with actual ML/AI service
 */
export async function POST(request: Request) {
    try {
        const { userId, researchType } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Get user's spend data
        const spends = await sql`
      SELECT category, total_spend, transaction_count, month_year
      FROM spend_clusters
      WHERE user_id = ${userId}
      ORDER BY month_year DESC
      LIMIT 12
    `;

        // Simple AI-like insights
        const insights = generateInsights(spends.rows, researchType);

        return NextResponse.json({ insights });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Get trending categories across all users
        const trending = await sql`
      SELECT category, SUM(total_spend) as total, COUNT(DISTINCT user_id) as users
      FROM spend_clusters
      WHERE month_year = DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY category
      ORDER BY total DESC
      LIMIT 5
    `;

        // Get personalized recommendations
        const userCategories = await sql`
      SELECT category, SUM(total_spend) as total
      FROM spend_clusters
      WHERE user_id = ${userId}
      GROUP BY category
      ORDER BY total DESC
      LIMIT 3
    `;

        return NextResponse.json({
            trending: trending.rows,
            userFavoriteCategories: userCategories.rows,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Simple insight generation logic
function generateInsights(spends: any[], researchType: string) {
    const insights: any[] = [];

    // Calculate totals by category
    const categoryTotals: Record<string, number> = {};
    spends.forEach(spend => {
        if (!categoryTotals[spend.category]) {
            categoryTotals[spend.category] = 0;
        }
        categoryTotals[spend.category] += parseFloat(spend.total_spend);
    });

    // Top spending category
    const topCategory = Object.entries(categoryTotals)
        .sort(([, a], [, b]) => b - a)[0];

    if (topCategory) {
        insights.push({
            type: 'category_insight',
            title: `You spend the most on ${topCategory[0]}`,
            description: `${topCategory[0]} accounts for the largest portion of your spending at ₹${topCategory[1].toFixed(0)}`,
            recommendation: `Look for vouchers in ${topCategory[0]} to maximize savings`,
        });
    }

    // Spending trend
    if (spends.length >= 2) {
        const recent = parseFloat(spends[0].total_spend);
        const previous = parseFloat(spends[1].total_spend);
        const change = ((recent - previous) / previous * 100).toFixed(1);

        insights.push({
            type: 'trend',
            title: change.startsWith('-') ? 'Spending decreased' : 'Spending increased',
            description: `Your spending ${change.startsWith('-') ? 'decreased' : 'increased'} by ${Math.abs(parseFloat(change))}% compared to last month`,
            recommendation: change.startsWith('-')
                ? 'Great job managing your expenses!'
                : 'Consider setting a budget to control spending',
        });
    }

    // Rewards opportunity
    const totalSpend = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
    const potentialPoints = Math.floor(totalSpend / 100) * 10; // 10 points per ₹100

    insights.push({
        type: 'rewards',
        title: 'Earn more rewards',
        description: `Based on your spending patterns, you could earn up to ${potentialPoints} more points monthly`,
        recommendation: 'Use your tokenized cards for all transactions to maximize rewards',
    });

    return insights;
}
