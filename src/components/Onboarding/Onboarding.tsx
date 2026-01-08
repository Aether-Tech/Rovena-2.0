import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageSquare,
    Image,
    Palette,
    FolderArchive,
    BarChart3,
    Presentation,
    Zap,
    ChevronRight,
    ChevronLeft,
    X,
    Sparkles,
} from 'lucide-react';
import './Onboarding.css';

interface OnboardingProps {
    onComplete: () => void;
}

const slides = [
    {
        icon: Sparkles,
        title: 'Welcome to Rovena!',
        description: 'Your AI hub for productivity. Let\'s take a quick tour of the available features.',
        color: 'var(--accent-green)',
    },
    {
        icon: MessageSquare,
        title: 'AI Chat',
        description: 'Chat with AI to get answers, ideas, summaries, and more. Use the quick chat on the home page or access the dedicated section.',
        color: 'var(--accent-blue)',
    },
    {
        icon: Image,
        title: 'Image Generation',
        description: 'Create amazing images from text descriptions. Perfect for illustrations, concepts, and visual creations.',
        color: 'var(--accent-yellow)',
    },
    {
        icon: Palette,
        title: 'AI Canva',
        description: 'A digital whiteboard for diagramming, flowcharts, sketching, and more. Organize your ideas visually.',
        color: '#ec4899',
    },
    {
        icon: FolderArchive,
        title: 'Files',
        description: 'Access all content generated in the app: chats, images, presentations, charts, and canvas. Everything organized in one place.',
        color: '#8b5cf6',
    },
    {
        icon: BarChart3,
        title: 'Charts',
        description: 'Create data visualizations from your data. Generate professional charts with ease.',
        color: '#06b6d4',
    },
    {
        icon: Presentation,
        title: 'Presentations',
        description: 'Generate slides automatically with AI. Create professional presentations in minutes.',
        color: '#f97316',
    },
    {
        icon: Zap,
        title: 'Token System',
        description: 'Your usage is measured in tokens. Track your consumption on the home page and in settings. Plus Plan has 3M tokens/month!',
        color: 'var(--accent-green)',
    },
];

export function Onboarding({ onComplete }: OnboardingProps) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [direction, setDirection] = useState(0);

    const handleNext = () => {
        if (currentSlide < slides.length - 1) {
            setDirection(1);
            setCurrentSlide(currentSlide + 1);
        } else {
            onComplete();
        }
    };

    const handlePrev = () => {
        if (currentSlide > 0) {
            setDirection(-1);
            setCurrentSlide(currentSlide - 1);
        }
    };

    const handleSkip = () => {
        onComplete();
    };

    const slide = slides[currentSlide];
    const Icon = slide.icon;
    const isLastSlide = currentSlide === slides.length - 1;

    const slideVariants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 100 : -100,
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (direction: number) => ({
            x: direction < 0 ? 100 : -100,
            opacity: 0,
        }),
    };

    return (
        <div className="onboarding-overlay">
            <div className="onboarding-container">
                <button className="onboarding-skip" onClick={handleSkip}>
                    <X size={20} />
                </button>

                <div className="onboarding-content">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={currentSlide}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="onboarding-slide"
                        >
                            <motion.div
                                className="onboarding-icon"
                                style={{ background: `${slide.color}20`, color: slide.color }}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                            >
                                <Icon size={48} />
                            </motion.div>

                            <motion.h2
                                className="onboarding-title"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                            >
                                {slide.title}
                            </motion.h2>

                            <motion.p
                                className="onboarding-description"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                            >
                                {slide.description}
                            </motion.p>
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="onboarding-footer">
                    <div className="onboarding-dots">
                        {slides.map((_, index) => (
                            <button
                                key={index}
                                className={`onboarding-dot ${index === currentSlide ? 'active' : ''}`}
                                onClick={() => {
                                    setDirection(index > currentSlide ? 1 : -1);
                                    setCurrentSlide(index);
                                }}
                            />
                        ))}
                    </div>

                    <div className="onboarding-nav">
                        {currentSlide > 0 && (
                            <button className="btn btn-ghost onboarding-btn" onClick={handlePrev}>
                                <ChevronLeft size={18} />
                                Previous
                            </button>
                        )}
                        <button className="btn btn-primary onboarding-btn" onClick={handleNext}>
                            {isLastSlide ? 'Get Started' : 'Next'}
                            {!isLastSlide && <ChevronRight size={18} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}