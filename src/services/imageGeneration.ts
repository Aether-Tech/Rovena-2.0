// Image Generation Service
// Uses Pollinations.ai - Free AI image generation

export interface ImageGenerationParams {
    prompt: string;
    style: 'realistic' | 'digital-art' | 'sketch' | 'photography';
    ratio: '1:1' | '16:9' | '4:3' | '9:16';
}

// Style modifiers for different art styles
const styleModifiers: Record<string, string> = {
    'realistic': 'photorealistic, ultra detailed, 8k, high resolution',
    'digital-art': 'digital art, vibrant colors, artistic, illustration style',
    'sketch': 'pencil sketch, hand drawn, black and white, artistic sketch',
    'photography': 'professional photography, DSLR, sharp focus, natural lighting',
};

// Aspect ratio dimensions
const ratioDimensions: Record<string, { width: number; height: number }> = {
    '1:1': { width: 1024, height: 1024 },
    '16:9': { width: 1280, height: 720 },
    '4:3': { width: 1024, height: 768 },
    '9:16': { width: 720, height: 1280 },
};

/**
 * Generates an image using Pollinations.ai API
 * This is a free API that doesn't require authentication
 */
export async function generateImage(params: ImageGenerationParams): Promise<string> {
    const { prompt, style, ratio } = params;

    // Enhance prompt with style modifiers
    const enhancedPrompt = `${prompt}, ${styleModifiers[style]}`;

    // Get dimensions for the ratio
    const dimensions = ratioDimensions[ratio];

    // Encode the prompt for URL
    const encodedPrompt = encodeURIComponent(enhancedPrompt);

    // Generate unique seed to avoid caching same images
    const seed = Math.floor(Math.random() * 1000000);

    // Pollinations.ai URL format
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${dimensions.width}&height=${dimensions.height}&seed=${seed}&nologo=true`;

    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Erro: ${response.status} - ${response.statusText}`);
        }
        // If successful, return the URL (browser will load it from cache mostly)
        return imageUrl;
    } catch (error) {
        console.error("Image generation error:", error);
        throw new Error('Falha ao gerar imagem. Verifique sua conexão.');
    }
}
