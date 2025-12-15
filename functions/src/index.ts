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

/**
 * Generate presentation slides using AI
 */
export const generatePresentation = functions
    .runWith({ secrets: ["OPENAI_API_KEY"] })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { topic, language, writingStyle, slideCount, stylization } = data;

        if (!topic || typeof topic !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'Topic string required');
        }

        try {
            const openai = getOpenAI();

            const languageMap: Record<string, string> = {
                'pt-BR': 'Portuguese (Brazilian)',
                'en-US': 'English (American)',
                'es-ES': 'Spanish',
                'fr-FR': 'French',
                'de-DE': 'German',
            };

            const writingStyleMap: Record<string, string> = {
                'formal': 'formal and professional',
                'dynamic': 'dynamic and engaging',
                'casual': 'casual and friendly',
                'academic': 'academic and scholarly',
                'persuasive': 'persuasive and compelling',
            };

            const elaboration = stylization > 70 ? 'very detailed with examples and explanations' : 
                               stylization > 40 ? 'moderately detailed' : 'concise and to the point';

            const response = await openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: `You are a presentation content creator. Generate professional, complete presentation slides.

CRITICAL: Return ONLY raw JSON. NO markdown, NO code blocks, NO \`\`\`json.

JSON structure:
{"title":"Presentation Title","slides":[{"title":"Slide Title","subtitle":"Optional subtitle","content":"Content with bullet points using •","speakerNotes":"Notes","background":"#1a1a2e","imageDescription":"Visual description"}]}

Guidelines:
- Language: ${languageMap[language] || 'Portuguese (Brazilian)'}
- Writing style: ${writingStyleMap[writingStyle] || 'formal and professional'}
- Detail level: ${elaboration}
- Generate exactly ${slideCount || 5} slides
- Slide 1: Title slide with main title and subtitle ONLY (no content)
- Slides 2 to ${slideCount - 1}: Content slides - each covering ONE specific subtopic
- Last slide: Conclusion/summary

IMPORTANT - Each content slide MUST:
• Have a UNIQUE title representing one aspect/section of the topic
• Have DIFFERENT content from other slides - divide the subject matter
• Include 3-5 bullet points (use • symbol) specific to that section
• Include imageDescription matching that specific section's content

Example division for "Climate Change" (5 slides):
1. "Climate Change" (title slide)
2. "Causes of Climate Change" (fossil fuels, deforestation, etc)
3. "Environmental Impacts" (rising temps, sea levels, etc)
4. "Solutions and Actions" (renewable energy, policies, etc)
5. "Conclusion" (summary and call to action)

Background colors: #1a1a2e, #1e293b, #1f2937, #172554, #1c1917, #0f172a`
                    },
                    {
                        role: 'user',
                        content: `Create a comprehensive presentation about: ${topic}`
                    }
                ],
                max_tokens: 4000,
                temperature: 0.7,
            });

            let content = response.choices[0].message.content || '';
            
            // Strip markdown code blocks if present
            content = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
            
            const parsed = JSON.parse(content);

            if (!Array.isArray(parsed.slides)) {
                throw new Error('Invalid response structure');
            }

            return {
                title: parsed.title || topic,
                slides: parsed.slides,
            };

        } catch (error: any) {
            console.error('Error generating presentation:', error);
            if (error instanceof SyntaxError) {
                throw new functions.https.HttpsError('internal', 'Failed to parse AI response');
            }
            throw new functions.https.HttpsError('internal', error.message || 'Error generating presentation');
        }
    });

/**
 * Enhance/improve user prompt for better presentation generation
 */
export const enhancePrompt = functions
    .runWith({ secrets: ["OPENAI_API_KEY"] })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { prompt, language } = data;

        if (!prompt || typeof prompt !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'Prompt string required');
        }

        try {
            const openai = getOpenAI();

            const languageMap: Record<string, string> = {
                'pt-BR': 'Portuguese (Brazilian)',
                'en-US': 'English',
                'es-ES': 'Spanish',
                'fr-FR': 'French',
                'de-DE': 'German',
            };

            const response = await openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: `You are a prompt enhancement specialist. Your job is to take a basic presentation topic and expand it into a detailed, well-structured prompt that will generate an excellent presentation.

Guidelines:
- Respond in ${languageMap[language] || 'Portuguese (Brazilian)'}
- Add specific subtopics that should be covered
- Suggest a logical flow and structure
- Include relevant aspects the user might not have considered
- Make it more specific and actionable
- Keep the enhanced prompt concise but comprehensive (max 200 words)

Return ONLY the enhanced prompt text, no explanations or formatting.`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 500,
                temperature: 0.7,
            });

            return {
                enhancedPrompt: response.choices[0].message.content || prompt,
            };

        } catch (error: any) {
            console.error('Error enhancing prompt:', error);
            throw new functions.https.HttpsError('internal', error.message || 'Error enhancing prompt');
        }
    });

/**
 * Generate image prompts for each slide based on content
 */
export const generateImagePrompts = functions
    .runWith({ secrets: ["OPENAI_API_KEY"] })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { slides, imageStyle, presentationTitle } = data;

        if (!slides || !Array.isArray(slides)) {
            throw new functions.https.HttpsError('invalid-argument', 'Slides array required');
        }

        try {
            const openai = getOpenAI();

            const styleMap: Record<string, string> = {
                'minimal': 'minimalist, clean, simple shapes, muted colors, plenty of white space, modern design',
                'professional': 'corporate, polished, business-appropriate, clean lines, modern, high quality',
                'creative': 'artistic, bold colors, unique compositions, expressive, vibrant, imaginative',
                'modern': 'contemporary, sleek, gradient colors, geometric shapes, tech-forward, stylish',
                'classic': 'timeless, elegant, traditional, refined aesthetics, sophisticated',
            };

            const styleDescription = styleMap[imageStyle] || styleMap['professional'];

            const response = await openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert at creating DALL-E 3 image prompts for presentation slides.

CRITICAL: Return ONLY raw JSON array. NO markdown, NO code blocks, NO \`\`\`json.

STYLE: ${styleDescription}

RULES:
- Images MUST be abstract/conceptual, NO text, NO words, NO letters
- Each prompt should match the SPECIFIC content of that slide
- Prompts should be 40-80 words
- Include: art style, lighting, mood, composition, colors
- NEVER include: text, letters, words, logos, human faces

Return format: [{"slideIndex": 0, "imagePrompt": "detailed prompt"}, ...]`
                    },
                    {
                        role: 'user',
                        content: `Presentation: "${presentationTitle}"

Slides:
${slides.map((slide: { title?: string; content?: string; imageDescription?: string }, idx: number) => {
    const desc = slide.imageDescription ? `\nIdeal image: ${slide.imageDescription}` : '';
    return `${idx}. Title: "${slide.title}"${desc}\nContent: "${(slide.content || '').substring(0, 150)}"`;
}).join('\n\n')}`
                    }
                ],
                max_tokens: 2500,
                temperature: 0.8,
            });

            let content = response.choices[0].message.content || '[]';
            
            // Strip markdown code blocks if present
            content = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
            
            const parsed = JSON.parse(content);

            return { imagePrompts: parsed };

        } catch (error: any) {
            console.error('Error generating image prompts:', error);
            throw new functions.https.HttpsError('internal', error.message || 'Error generating image prompts');
        }
    });

/**
 * Generate a single slide (text + image) with context from previous slides
 */
export const generateSingleSlide = functions
    .runWith({ secrets: ["OPENAI_API_KEY"], timeoutSeconds: 180 })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { 
            topic, 
            language, 
            writingStyle, 
            slideIndex, 
            totalSlides, 
            stylization, 
            imageStyle,
            previousSlides 
        } = data;

        if (!topic || typeof topic !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'Topic string required');
        }

        try {
            const openai = getOpenAI();

            const languageMap: Record<string, string> = {
                'pt-BR': 'Portuguese (Brazilian)',
                'en-US': 'English (American)',
                'es-ES': 'Spanish',
                'fr-FR': 'French',
                'de-DE': 'German',
            };

            const writingStyleMap: Record<string, string> = {
                'formal': 'formal and professional',
                'dynamic': 'dynamic and engaging',
                'casual': 'casual and friendly',
                'academic': 'academic and scholarly',
                'persuasive': 'persuasive and compelling',
            };

            const styleMap: Record<string, string> = {
                'minimal': 'minimalist, clean, simple shapes, muted colors, plenty of white space, modern design',
                'professional': 'corporate, polished, business-appropriate, clean lines, modern, high quality',
                'creative': 'artistic, bold colors, unique compositions, expressive, vibrant, imaginative',
                'modern': 'contemporary, sleek, gradient colors, geometric shapes, tech-forward, stylish',
                'classic': 'timeless, elegant, traditional, refined aesthetics, sophisticated',
            };

            const elaboration = stylization > 70 ? 'very detailed with examples and explanations' : 
                               stylization > 40 ? 'moderately detailed' : 'concise and to the point';

            const isFirstSlide = slideIndex === 0;
            const isLastSlide = slideIndex === totalSlides - 1;

            let slideTypeInstruction = '';
            if (isFirstSlide) {
                slideTypeInstruction = 'This is the TITLE SLIDE. Generate only a compelling title and subtitle. NO bullet points.';
            } else if (isLastSlide) {
                slideTypeInstruction = 'This is the CONCLUSION SLIDE. Summarize key points and include a call to action.';
            } else {
                slideTypeInstruction = `This is CONTENT SLIDE ${slideIndex} of ${totalSlides - 2} content slides. Cover a UNIQUE aspect not covered in previous slides.`;
            }

            const previousContext = previousSlides && previousSlides.length > 0 
                ? `\n\nPREVIOUS SLIDES ALREADY CREATED (DO NOT REPEAT THESE TOPICS):\n${previousSlides.map((s: {title?: string; content?: string}, i: number) => `Slide ${i}: "${s.title}" - ${(s.content || '').substring(0, 100)}`).join('\n')}`
                : '';

            const textResponse = await openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: `You are creating slide ${slideIndex + 1} of ${totalSlides} for a presentation.

CRITICAL: Return ONLY raw JSON. NO markdown, NO code blocks.

${slideTypeInstruction}

JSON structure:
{"title":"Slide Title","subtitle":"Optional subtitle (title slide only)","content":"Content with bullet points using •","background":"#1a1a2e","imageDescription":"Visual concept for this specific slide"}

Guidelines:
- Language: ${languageMap[language] || 'Portuguese (Brazilian)'}
- Writing style: ${writingStyleMap[writingStyle] || 'formal and professional'}
- Detail level: ${elaboration}
- Use • for bullet points (3-5 points for content slides)
- imageDescription should be specific to THIS slide's content${previousContext}

Background colors: #1a1a2e, #1e293b, #1f2937, #172554, #1c1917, #0f172a`
                    },
                    {
                        role: 'user',
                        content: `Create slide ${slideIndex + 1} for presentation about: ${topic}`
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7,
            });

            let textContent = textResponse.choices[0].message.content || '';
            textContent = textContent.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
            
            const slideData = JSON.parse(textContent);

            const imagePromptResponse = await openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: `Create a DALL-E 3 image prompt. Return ONLY the prompt text, no JSON, no quotes.

STYLE: ${styleMap[imageStyle] || styleMap['professional']}

RULES:
- Abstract/conceptual visual, NO text, NO words, NO letters
- 40-80 words
- Include: art style, lighting, mood, composition, colors
- NEVER include: text, letters, words, logos, human faces`
                    },
                    {
                        role: 'user',
                        content: `Create image prompt for slide titled "${slideData.title}" with content: "${(slideData.content || slideData.imageDescription || '').substring(0, 200)}"`
                    }
                ],
                max_tokens: 200,
                temperature: 0.8,
            });

            const imagePrompt = imagePromptResponse.choices[0].message.content || '';

            let imageUrl = '';
            try {
                const imageResponse = await openai.images.generate({
                    model: 'dall-e-3',
                    prompt: imagePrompt,
                    n: 1,
                    size: '1792x1024',
                    quality: 'standard',
                    style: 'vivid',
                });
                imageUrl = imageResponse.data?.[0]?.url || '';
            } catch (imgError) {
                console.error('Error generating image for slide:', imgError);
            }

            return {
                slideIndex,
                title: slideData.title,
                subtitle: slideData.subtitle,
                content: slideData.content,
                background: slideData.background || '#1a1a2e',
                imageDescription: slideData.imageDescription,
                imageUrl,
            };

        } catch (error: any) {
            console.error('Error generating single slide:', error);
            throw new functions.https.HttpsError('internal', error.message || 'Error generating slide');
        }
    });

/**
 * Generate image using DALL-E 3
 */
export const generateSlideImage = functions
    .runWith({ secrets: ["OPENAI_API_KEY"], timeoutSeconds: 120 })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { prompt, size } = data;

        if (!prompt || typeof prompt !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'Prompt string required');
        }

        try {
            const openai = getOpenAI();

            const validSizes = ['1024x1024', '1024x1792', '1792x1024'];
            const imageSize = validSizes.includes(size) ? size : '1024x1024';

            const response = await openai.images.generate({
                model: 'dall-e-3',
                prompt: prompt,
                n: 1,
                size: imageSize as '1024x1024' | '1024x1792' | '1792x1024',
                quality: 'standard',
                style: 'vivid',
            });

            const imageUrl = response.data?.[0]?.url;

            if (!imageUrl) {
                throw new Error('No image URL returned');
            }

            return { imageUrl };

        } catch (error: any) {
            console.error('Error generating image:', error);
            throw new functions.https.HttpsError('internal', error.message || 'Error generating image');
        }
    });

/**
 * Generate presentation using Gamma.app API v1.0
 */
export const generateGammaPresentation = functions
    .runWith({ secrets: ["GAMMA_API_KEY"], timeoutSeconds: 300 })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { topic, language, writingStyle, imageStyle, slideCount, stylization } = data;

        if (!topic || typeof topic !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'Topic string required');
        }

        const gammaApiKey = process.env.GAMMA_API_KEY;
        if (!gammaApiKey) {
            throw new functions.https.HttpsError('internal', 'Gamma API key not configured');
        }

        try {
            const languageMap: Record<string, string> = {
                'pt-BR': 'pt-br',
                'en-US': 'en',
                'es-ES': 'es',
                'es-MX': 'es-mx',
                'fr-FR': 'fr',
                'de-DE': 'de',
                'it-IT': 'it',
                'ja-JP': 'ja',
                'ko-KR': 'ko',
                'zh-CN': 'zh-cn',
                'ru-RU': 'ru',
                'nl-NL': 'nl',
                'pt-PT': 'pt-pt',
            };

            const toneMap: Record<string, string> = {
                'formal': 'professional, formal',
                'dynamic': 'engaging, dynamic',
                'casual': 'casual, friendly',
                'academic': 'academic, scholarly',
                'persuasive': 'persuasive, compelling',
            };

            const styleMap: Record<string, string> = {
                'minimal': 'minimalist',
                'professional': 'photorealistic',
                'creative': 'artistic',
                'modern': 'digital art',
                'classic': 'classic',
            };

            const textAmount = stylization > 70 ? 'detailed' : 
                              stylization > 40 ? 'medium' : 'concise';

            const requestBody = {
                inputText: topic,
                textMode: 'generate',
                format: 'presentation',
                numCards: Math.min(60, Math.max(1, slideCount)),
                cardSplit: 'auto',
                textOptions: {
                    amount: textAmount,
                    tone: toneMap[writingStyle] || 'professional',
                    language: languageMap[language] || 'pt',
                },
                imageOptions: {
                    source: 'aiGenerated',
                    model: 'imagen-4-pro',
                    style: styleMap[imageStyle] || 'photorealistic',
                },
                cardOptions: {
                    dimensions: '16x9',
                },
                sharingOptions: {
                    workspaceAccess: 'edit',
                    externalAccess: 'view',
                },
                exportAs: 'pptx',
            };

            console.log('Calling Gamma API with:', JSON.stringify(requestBody, null, 2));

            const response = await fetch('https://public-api.gamma.app/v1.0/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': gammaApiKey,
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Gamma API error:', response.status, errorText);
                throw new Error(`Gamma API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('Gamma API initial result:', JSON.stringify(result, null, 2));

            const generationId = result.generationId;
            if (!generationId) {
                throw new Error('No generationId returned from Gamma API');
            }

            let finalResult = result;
            let attempts = 0;
            const maxAttempts = 60;
            const pollInterval = 5000;

            while (attempts < maxAttempts) {
                if (finalResult.status === 'completed' && finalResult.gammaUrl) {
                    break;
                }
                
                if (finalResult.status === 'failed') {
                    throw new Error('Gamma generation failed');
                }

                await new Promise(resolve => setTimeout(resolve, pollInterval));
                attempts++;

                const pollResponse = await fetch(`https://public-api.gamma.app/v1.0/generations/${generationId}`, {
                    method: 'GET',
                    headers: {
                        'X-API-KEY': gammaApiKey,
                    },
                });

                if (!pollResponse.ok) {
                    console.error('Gamma poll error:', pollResponse.status);
                    continue;
                }

                finalResult = await pollResponse.json();
                console.log(`Gamma poll attempt ${attempts}:`, JSON.stringify(finalResult, null, 2));
            }

            if (!finalResult.gammaUrl) {
                throw new Error('Generation timed out - please try again');
            }

            return {
                status: finalResult.status,
                generationId: finalResult.generationId,
                gammaUrl: finalResult.gammaUrl,
                downloadUrl: finalResult.downloadUrl,
                credits: finalResult.credits,
            };

        } catch (error: any) {
            console.error('Error generating Gamma presentation:', error);
            throw new functions.https.HttpsError('internal', error.message || 'Error generating presentation with Gamma');
        }
    });