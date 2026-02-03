"use client"

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Define the types for the props to ensure type safety and clarity
interface Feature {
    icon: React.ReactNode;
    title: string;
}

interface Benefit {
    icon: React.ReactNode;
    title: string;
}

export interface AppDownloadSectionProps {
    title: string;
    subtitle: string;
    features: Feature[];
    benefits: Benefit[];
    qrCodeUrl: string;
    qrCodeAlt: string;
    mainImageUrl: string;
    mainImageAlt: string;
    className?: string;
}

// Animation variants for Framer Motion
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
        },
    },
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: {
            type: 'spring' as const,
            stiffness: 100,
        },
    },
};

const imageVariants = {
    hidden: { x: 50, opacity: 0, scale: 0.9 },
    visible: {
        x: 0,
        opacity: 1,
        scale: 1,
        transition: {
            type: 'spring' as const,
            duration: 1.2,
            bounce: 0.3,
        }
    }
}

export const AppDownloadSection = ({
    title,
    subtitle,
    features,
    benefits,
    qrCodeUrl,
    qrCodeAlt,
    mainImageUrl,
    mainImageAlt,
    className,
}: AppDownloadSectionProps) => {
    return (
        <section className={cn('w-full bg-background text-foreground py-12 lg:py-24', className)}>
            <motion.div
                className="container mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center px-4"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                variants={containerVariants}
            >
                {/* Left Content Column */}
                <div className="flex flex-col space-y-8">
                    <motion.div className="space-y-2" variants={itemVariants}>
                        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">{title}</h2>
                        <p className="text-muted-foreground text-xl leading-relaxed">{subtitle}</p>
                    </motion.div>

                    {/* Features Section */}
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-6">
                        {features.map((feature, index) => (
                            <motion.div key={index} className="flex items-center space-x-4 p-4 rounded-2xl bg-muted/50 border border-border/50" variants={itemVariants}>
                                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary">
                                    {feature.icon}
                                </div>
                                <span className="text-sm font-semibold">{feature.title}</span>
                            </motion.div>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-8">
                        {/* QR Code Section */}
                        <motion.div className="flex flex-col items-center space-y-3 p-4 rounded-3xl bg-white border shadow-sm" variants={itemVariants}>
                            <img src={qrCodeUrl} alt={qrCodeAlt} className="w-32 h-32 rounded-lg" />
                            <p className="text-xs font-bold text-gray-900">Scan to Download</p>
                        </motion.div>

                        {/* Benefits Section */}
                        <div className="flex flex-col space-y-3">
                            {benefits.map((benefit, index) => (
                                <motion.div key={index} className="flex items-center space-x-3" variants={itemVariants}>
                                    <div className='flex items-center justify-center w-6 h-6 rounded-full bg-green-500/10 text-green-600'>
                                        {benefit.icon}
                                    </div>
                                    <span className="text-sm font-medium text-muted-foreground">{benefit.title}</span>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Right Image Column */}
                <motion.div className="flex items-center justify-center relative" variants={imageVariants}>
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-75 opacity-50" />
                    <img
                        src={mainImageUrl}
                        alt={mainImageAlt}
                        className="max-w-md w-full h-auto object-contain drop-shadow-2xl relative z-10"
                    />
                </motion.div>
            </motion.div>
        </section>
    );
};
