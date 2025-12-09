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

    // Pre-load the image to ensure it's ready
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            resolve(imageUrl);
        };

        img.onerror = () => {
            reject(new Error('Falha ao gerar imagem. Tente novamente.'));
        };

        // Set timeout for slow generations
        const timeout = setTimeout(() => {
            reject(new Error('Timeout: A geração está demorando muito. Tente novamente.'));
        }, 60000); // 60 seconds timeout

        img.onload = () => {
            clearTimeout(timeout);
            resolve(imageUrl);
        };

        img.src = imageUrl;
    });
}
