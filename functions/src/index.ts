import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import OpenAI from 'openai';

admin.initializeApp();
const db = admin.firestore();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16',
});

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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
export const checkSubscription = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const email = context.auth.token.email;
    if (!email) {
        throw new functions.https.HttpsError('invalid-argument', 'User email not found');
    }

    try {
        // Search for customer by email
        const customers = await stripe.customers.list({
            email: email,
            limit: 1,
        });

        if (customers.data.length === 0) {
            return { plan: 'free', tokensLimit: TOKEN_LIMITS.free };
        }

        const customer = customers.data[0];

        // Get active subscriptions
        const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'active',
            limit: 10,
        });

        // Check if any subscription matches our product IDs
        for (const subscription of subscriptions.data) {
            for (const item of subscription.items.data) {
                const productId = item.price.product as string;
                if (Object.values(PRODUCT_IDS).includes(productId)) {
                    return {
                        plan: 'plus',
                        tokensLimit: TOKEN_LIMITS.plus,
                        subscriptionId: subscription.id,
                        productId: productId,
                    };
                }
            }
        }

        return { plan: 'free', tokensLimit: TOKEN_LIMITS.free };
    } catch (error) {
        console.error('Error checking subscription:', error);
        throw new functions.https.HttpsError('internal', 'Error checking subscription');
    }
});

/**
 * Cancel user subscription
 */
export const cancelSubscription = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { subscriptionId } = data;
    if (!subscriptionId) {
        throw new functions.https.HttpsError('invalid-argument', 'Subscription ID required');
    }

    try {
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
export const sendChatMessage = functions.https.onCall(async (data, context) => {
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
        const userData = userDoc.data() || { tokensUsed: 0 };

        // Check subscription
        const subscriptionResult = await checkSubscription(null, context);
        const tokensLimit = subscriptionResult.tokensLimit || TOKEN_LIMITS.free;

        if (userData.tokensUsed >= tokensLimit) {
            throw new functions.https.HttpsError('resource-exhausted', 'Token limit reached');
        }

        // Use custom API key if provided, otherwise use default
        const client = customApiKey
            ? new OpenAI({ apiKey: customApiKey })
            : openai;

        const response = await client.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: messages,
            max_tokens: 4096,
        });

        const usage = response.usage;
        const totalTokens = usage?.total_tokens || 0;

        // Update user token usage
        await db.collection('users').doc(userId).update({
            tokensUsed: admin.firestore.FieldValue.increment(totalTokens),
            messagesCount: admin.firestore.FieldValue.increment(1),
            interactionsCount: admin.firestore.FieldValue.increment(1),
        });

        return {
            message: response.choices[0].message,
            tokensUsed: totalTokens,
            remainingTokens: tokensLimit - (userData.tokensUsed + totalTokens),
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
