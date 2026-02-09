'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { cn } from '@/lib/utils'; // Assuming cn utility is at this path, adjust if needed

export type MascotState = 'idle' | 'happy' | 'meditating' | 'sleeping' | 'active';

export interface MascotProps {
    state?: MascotState;
    className?: string;
    size?: number;
    interactive?: boolean;
    withGlow?: boolean;
}

const mascotImages: Record<MascotState, string> = {
    idle: '/mascot/idle.png',
    happy: '/mascot/happy.png',
    meditating: '/mascot/meditating.png',
    sleeping: '/mascot/sleeping.png',
    active: '/mascot/active.png',
};

export function Mascot({
    state = 'idle',
    className,
    size = 200,
    interactive = true,
    withGlow = false,
}: MascotProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [currentState, setCurrentState] = useState<MascotState>(state);

    useEffect(() => {
        setCurrentState(state);
    }, [state]);

    // Animation variants
    const variants = {
        initial: { scale: 0.8, opacity: 0, y: 20 },
        enter: {
            scale: 1,
            opacity: 1,
            y: 0,
            transition: {
                type: 'spring' as const,
                stiffness: 300,
                damping: 20
            }
        },
        exit: { scale: 0.8, opacity: 0, transition: { duration: 0.2 } },
        hover: {
            scale: 1.05,
            y: -10,
            rotate: [0, -5, 5, 0],
            transition: {
                rotate: {
                    repeat: Infinity,
                    repeatType: 'reverse' as const,
                    duration: 0.5
                }
            }
        },
        floating: {
            y: [0, -15, 0],
            transition: {
                duration: 3,
                ease: "easeInOut" as const
            }
        }
    };

    return (
        <div className="relative flex justify-center items-center">
            {withGlow && (
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                    className="absolute z-0 rounded-full bg-white/60 blur-2xl"
                    style={{
                        width: size * 1.5,
                        height: size * 1.5,
                        maxWidth: '150%',
                        maxHeight: '150%'
                    }}
                />
            )}

            <div
                className={cn("relative flex items-center justify-center z-10", className)}
                style={{ width: size, height: size }}
                onMouseEnter={() => interactive && setIsHovered(true)}
                onMouseLeave={() => interactive && setIsHovered(false)}
            >
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentState}
                        className="relative w-full h-full"
                        variants={variants}
                        initial="initial"
                        animate={isHovered ? "hover" : ["enter", "floating"]}
                        exit="exit"
                    >
                        <Image
                            src={mascotImages[currentState]}
                            alt={`Yachai Mascot - ${currentState}`}
                            fill
                            className="object-contain drop-shadow-2xl"
                            priority
                            draggable={false}
                        />
                    </motion.div>
                </AnimatePresence>

                {/* Optional: Shadow element (only if glow is OFF, otherwise it looks weird) */}
                {!withGlow && (
                    <motion.div
                        className="absolute bottom-0 w-1/2 h-4 bg-black/10 rounded-full blur-md"
                        animate={{
                            scale: [1, 0.8, 1],
                            opacity: [0.3, 0.1, 0.3]
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                )}
            </div>
        </div>
    );
}
