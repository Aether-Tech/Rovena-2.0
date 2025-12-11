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
        title: 'Bem-vindo ao Rovena!',
        description: 'Sua central de IA para produtividade. Vamos fazer um tour rápido pelas funcionalidades disponíveis.',
        color: 'var(--accent-green)',
    },
    {
        icon: MessageSquare,
        title: 'Chat com IA',
        description: 'Converse com a IA para obter respostas, ideias, resumos e muito mais. Use o chat rápido na home ou acesse a seção dedicada.',
        color: 'var(--accent-blue)',
    },
    {
        icon: Image,
        title: 'Geração de Imagens',
        description: 'Crie imagens incríveis a partir de descrições de texto. Perfeito para ilustrações, conceitos e criações visuais.',
        color: 'var(--accent-yellow)',
    },
    {
        icon: Palette,
        title: 'Canva IA',
        description: 'Uma lousa digital para diagramação, fluxogramas, esboços e muito mais. Organize suas ideias visualmente.',
        color: '#ec4899',
    },
    {
        icon: FolderArchive,
        title: 'Arquivos',
        description: 'Acesse todo conteúdo gerado no app: chats, imagens, apresentações, gráficos e canvas. Tudo organizado em um só lugar.',
        color: '#8b5cf6',
    },
    {
        icon: BarChart3,
        title: 'Gráficos',
        description: 'Crie visualizações de dados a partir de seus dados. Gere gráficos profissionais com facilidade.',
        color: '#06b6d4',
    },
    {
        icon: Presentation,
        title: 'Apresentações',
        description: 'Gere slides automaticamente com IA. Crie apresentações profissionais em minutos.',
        color: '#f97316',
    },
    {
        icon: Zap,
        title: 'Sistema de Tokens',
        description: 'Seu uso é medido em tokens. Acompanhe seu consumo na home e nas configurações. Plano Plus tem 3M tokens/mês!',
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
                                Anterior
                            </button>
                        )}
                        <button className="btn btn-primary onboarding-btn" onClick={handleNext}>
                            {isLastSlide ? 'Começar' : 'Próximo'}
                            {!isLastSlide && <ChevronRight size={18} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}