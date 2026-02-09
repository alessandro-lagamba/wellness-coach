import React from 'react';
import { motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface MinimalistHeroProps {
    logoText: string;
    mainText: string;
    imageSrc: string;
    imageAlt: string;
    overlayText: {
        part1: string;
        part2: string;
    };
    scrollToId: string;
    className?: string;
}

export const MinimalistHero = ({
    logoText,
    mainText,
    imageSrc,
    imageAlt,
    overlayText,
    scrollToId,
    className,
}: MinimalistHeroProps) => {
    const handleScroll = () => {
        const element = document.getElementById(scrollToId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className={cn(
                'relative flex min-h-screen w-full flex-col items-center justify-between overflow-hidden bg-sky-50 font-sans p-8 md:p-12',
                className
            )}
        >
            {/* Header */}
            <header className="z-30 flex w-full max-w-7xl items-center justify-between">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-2xl font-black tracking-tighter text-sky-900"
                >
                    {logoText}
                </motion.div>
            </header>

            {/* Main Content Area */}
            <div className="relative grid w-full max-w-7xl flex-grow grid-cols-1 items-center md:grid-cols-3 gap-8 md:gap-0">

                {/* Left Text Content */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    className="z-20 order-2 md:order-1 text-center md:text-left"
                >
                    <p className="mx-auto max-w-xs text-lg font-medium leading-relaxed text-sky-800/80 md:mx-0">
                        {mainText}
                    </p>
                </motion.div>

                {/* Center Image with Circle */}
                <div className="relative order-1 md:order-2 flex justify-center items-center h-full min-h-[300px] md:min-h-[500px]">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                        className="absolute z-0 h-[280px] w-[280px] rounded-full bg-white/60 blur-2xl md:h-[450px] md:w-[450px]"
                    ></motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                        className="relative z-10 w-64 md:w-80 lg:w-96"
                    >
                        <Image
                            src={imageSrc}
                            alt={imageAlt}
                            width={500}
                            height={500}
                            className="object-contain drop-shadow-2xl"
                            priority
                        />
                    </motion.div>
                </div>

                {/* Right Text */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: 0.7 }}
                    className="z-20 order-3 flex items-center justify-center md:justify-end text-center md:text-right"
                >
                    <h1 className="text-6xl font-black text-sky-900 md:text-7xl lg:text-8xl tracking-tighter leading-[0.9]">
                        {overlayText.part1}
                        <br />
                        <span className="text-purple-600">{overlayText.part2}</span>
                    </h1>
                </motion.div>
            </div>

            {/* Footer / CTA */}
            <footer className="z-30 flex w-full max-w-7xl items-center justify-center pb-8">
                <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 1.5 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleScroll}
                    className="group flex flex-col items-center gap-2 text-sky-600 hover:text-purple-600 transition-colors cursor-pointer"
                >
                    <span className="text-sm font-bold tracking-widest uppercase">Inizia il tour</span>
                    <div className="p-3 bg-white rounded-full shadow-lg group-hover:shadow-xl transition-all">
                        <ArrowDown className="w-6 h-6 animate-bounce" />
                    </div>
                </motion.button>
            </footer>
        </motion.div>
    );
};
