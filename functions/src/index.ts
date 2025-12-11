import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import OpenAI from 'openai';

admin.initializeApp();
const db = admin.firestore();

// Lazy verification singleton helpers
let stripeInstance: Stripe | null = null;
const getStripe = () => {
    if (!stripeInstance) {
        stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
            apiVersion: '2023-10-16',
        });
    }
    return stripeInstance;
};

let openaiInstance: OpenAI | null = null;
const getOpenAI = () => {
    if (!openaiInstance) {
        openaiInstance = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    return openaiInstance;
};

// Stripe Product IDs
const PRODUCT_IDS = {
    MONTHLY: 'prod_TV9GzjLJOU202c',
    ANNUAL: 'prod_TZBcZ2ILyWo1gq',
    LIFETIME: 'prod_TZBcluUW1QWSgZ',
};

// Token limits
const TOKEN_LIMITS = {
    free: 10000,
    plus: 3000000,
};

/**
 * Check user subscription status via Stripe
 */
export const checkSubscription = functions
    .runWith({ secrets: ["STRIPE_SECRET_KEY"] })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const email = context.auth.token.email;
        if (!email) {
            throw new functions.https.HttpsError('invalid-argument', 'User email not found');
        }

        try {
            return await getUserPlan(email);
        } catch (error) {
            console.error('Error checking subscription:', error);
            throw new functions.https.HttpsError('internal', 'Error checking subscription');
        }
    });

/**
 * Helper to determine user plan based on subscriptions and one-time purchases
 */
async function getUserPlan(email: string) {
    const stripe = getStripe();

    // 1. Search for customers (fetch all that match email)
    const customers = await stripe.customers.list({
        email: email,
        limit: 10, // Check up to 10 customer profiles with same email should be enough
    });

    if (customers.data.length === 0) {
        return { plan: 'free', tokensLimit: TOKEN_LIMITS.free };
    }

    // Check ALL found customers
    for (const customer of customers.data) {
        console.log(`Checking customer: ${customer.id}`);

        // 2. Check active subscriptions (Monthly/Annual)
        // Fetch all to debug status
        const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            limit: 20,
        });

        for (const subscription of subscriptions.data) {
            console.log(`Found subscription ${subscription.id} with status ${subscription.status}`);

            // Allow active and trialing
            if (['active', 'trialing'].includes(subscription.status)) {
                for (const item of subscription.items.data) {
                    const productId = item.price.product as string;
                    console.log(`Subscription item product: ${productId} (Expected active: ${JSON.stringify(Object.values(PRODUCT_IDS))})`);

                    if (Object.values(PRODUCT_IDS).includes(productId)) {
                        console.log(`Matched subscription plan: ${productId}`);
                        return {
                            plan: 'plus',
                            tokensLimit: TOKEN_LIMITS.plus,
                            subscriptionId: subscription.id,
                            productId: productId,
                        };
                    }
                }
            }
        }

        // 3. Check one-time purchases (Lifetime) via Checkout Sessions
        const sessions = await stripe.checkout.sessions.list({
            customer: customer.id,
            status: 'complete',
            limit: 20,
            expand: ['data.line_items'],
        });

        for (const session of sessions.data) {
            if (session.payment_status === 'paid' && session.line_items) {
                for (const item of session.line_items.data) {
                    const price = item.price;
                    const productId = price?.product as string;

                    console.log(`Found session item product: ${productId}`);

                    if (productId === PRODUCT_IDS.LIFETIME) {
                        console.log('Matched Lifetime plan!');
                        return {
                            plan: 'plus',
                            tokensLimit: TOKEN_LIMITS.plus,
                            subscriptionId: 'lifetime',
                            productId: PRODUCT_IDS.LIFETIME,
                        };
                    }
                }
            }
        }
    }

    console.log('No plan found, returning free.');
    return { plan: 'free', tokensLimit: TOKEN_LIMITS.free };
}

/**
 * Cancel user subscription
 */
export const cancelSubscription = functions
    .runWith({ secrets: ["STRIPE_SECRET_KEY"] })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { subscriptionId } = data;
        if (!subscriptionId) {
            throw new functions.https.HttpsError('invalid-argument', 'Subscription ID required');
        }

        if (subscriptionId === 'lifetime') {
            throw new functions.https.HttpsError('invalid-argument', 'Cannot cancel a lifetime plan');
        }

        try {
            const stripe = getStripe();
            await stripe.subscriptions.cancel(subscriptionId);
            return { success: true };
        } catch (error) {
            console.error('Error canceling subscription:', error);
            throw new functions.https.HttpsError('internal', 'Error canceling subscription');
        }
    });

/**
 * Get user token usage
 */
export const getUserTokens = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;

    try {
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            // Create new user document
            const newUserData = {
                tokensUsed: 0,
                messagesCount: 0,
                interactionsCount: 0,
                lastReset: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            await db.collection('users').doc(userId).set(newUserData);
            return newUserData;
        }

        return userDoc.data();
    } catch (error) {
        console.error('Error getting user tokens:', error);
        throw new functions.https.HttpsError('internal', 'Error getting token data');
    }
});

/**
 * Send chat message via OpenAI
 */
export const sendChatMessage = functions
    .runWith({ secrets: ["OPENAI_API_KEY", "STRIPE_SECRET_KEY"] })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const userId = context.auth.uid;
        const { messages, customApiKey } = data;

        if (!messages || !Array.isArray(messages)) {
            throw new functions.https.HttpsError('invalid-argument', 'Messages array required');
        }

        try {
            // Get user data to check token limit
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data() || { tokensUsed: 0 }; // Default if user doc missing

            // Verify plan using the shared helper
            const email = context.auth.token.email;
            let tokensLimit = TOKEN_LIMITS.free;

            if (email) {
                const planData = await getUserPlan(email);
                tokensLimit = planData.tokensLimit;
            }

            if ((userData.tokensUsed || 0) >= tokensLimit) {
                throw new functions.https.HttpsError('resource-exhausted', `Token limit reached for your plan (${tokensLimit}). Please upgrade.`);
            }

            // Use custom API key if provided, otherwise use default
            const client = customApiKey
                ? new OpenAI({ apiKey: customApiKey })
                : getOpenAI();

            const response = await client.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: messages,
                max_tokens: 4096,
            });

            const usage = response.usage;
            const totalTokens = usage?.total_tokens || 0;

            // Update user token usage
            await db.collection('users').doc(userId).set({
                tokensUsed: admin.firestore.FieldValue.increment(totalTokens),
                messagesCount: admin.firestore.FieldValue.increment(1),
                interactionsCount: admin.firestore.FieldValue.increment(1),
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            return {
                message: response.choices[0].message,
                tokensUsed: totalTokens,
                remainingTokens: Math.max(0, tokensLimit - ((userData.tokensUsed || 0) + totalTokens)),
            };
        } catch (error: any) {
            console.error('Error sending chat message:', error);
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            throw new functions.https.HttpsError('internal', error.message || 'Error processing message');
        }
    });

/**
 * Reset tokens monthly (scheduled function)
 */
export const resetMonthlyTokens = functions.pubsub
    .schedule('0 0 1 * *')
    .onRun(async () => {
        try {
            const usersSnapshot = await db.collection('users').get();
            const batch = db.batch();

            usersSnapshot.docs.forEach((doc) => {
                batch.update(doc.ref, {
                    tokensUsed: 0,
                    messagesCount: 0,
                    lastReset: admin.firestore.FieldValue.serverTimestamp(),
                });
            });

            await batch.commit();
            console.log(`Reset tokens for ${usersSnapshot.size} users`);
        } catch (error) {
            console.error('Error resetting tokens:', error);
        }
    });

/**
 * Parse chart data using AI
 */
export const parseChartData = functions
    .runWith({ secrets: ["OPENAI_API_KEY"] })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { rawData, chartType } = data;

        if (!rawData || typeof rawData !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'Raw data string required');
        }

        try {
            const openai = getOpenAI();

            const response = await openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: `You are a data parser assistant. Extract data from user input and return a JSON object with:
- labels: array of strings (categories/labels)
- values: array of numbers (corresponding values)
- title: string (a descriptive title for the chart)
- interpretation: string (a brief analysis/interpretation of the data in Portuguese)

The chart type is: ${chartType || 'bar'}

Return ONLY valid JSON, no markdown, no explanation. Example:
{"labels":["Jan","Feb","Mar"],"values":[10,20,30],"title":"Monthly Sales","interpretation":"Os dados mostram um crescimento constante..."}`
                    },
                    {
                        role: 'user',
                        content: rawData
                    }
                ],
                max_tokens: 1000,
                temperature: 0.3,
            });

            const content = response.choices[0].message.content || '';
            
            // Parse the JSON response
            const parsed = JSON.parse(content);

            if (!Array.isArray(parsed.labels) || !Array.isArray(parsed.values)) {
                throw new Error('Invalid data structure');
            }

            return {
                labels: parsed.labels,
                values: parsed.values,
                title: parsed.title || 'Gráfico',
                interpretation: parsed.interpretation || '',
            };

        } catch (error: any) {
            console.error('Error parsing chart data:', error);
            if (error instanceof SyntaxError) {
                throw new functions.https.HttpsError('internal', 'Não foi possível interpretar os dados. Tente reformular.');
            }
            throw new functions.https.HttpsError('internal', error.message || 'Erro ao processar dados');
        }
    });