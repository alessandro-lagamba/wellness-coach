"use client";

import { cn } from "@/lib/utils";
import React, { useState, useEffect } from "react";

interface Button3DProps {
    className?: string;
}

interface Sparkle {
    id: number;
    top: string;
    left: string;
    delay: string;
}

export const Button3D: React.FC<Button3DProps> = ({ className }) => {
    const text = "Got me right! ✨";
    const [sparkles, setSparkles] = useState<Sparkle[]>([]);

    // Fix Hydration Error: Generate sparkles only on the client
    useEffect(() => {
        const generatedSparkles = Array.from({ length: 12 }).map((_, i) => ({
            id: i,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            delay: `${Math.random() * 0.5}s`,
        }));
        setSparkles(generatedSparkles);
    }, []);

    const renderChars = (str: string) => {
        return str.split('').map((char, i) => (
            <span key={i} style={{ "--i": i + 1 } as React.CSSProperties}>
                {char === ' ' ? '\u00A0' : char}
            </span>
        ));
    };

    return (
        <div className={cn("button-3d-perspective", className)}>
            <div className="button-3d group select-none">
                <div className="bg-3d" />

                {/* Splash SVG - Centered on border */}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 342 208" height={208} width={342} className="splash">
                    <path strokeLinecap="round" strokeWidth={3} d="M54.1054 99.7837C54.1054 99.7837 40.0984 90.7874 26.6893 97.6362C13.2802 104.485 1.5 97.6362 1.5 97.6362" />
                    <path strokeLinecap="round" strokeWidth={3} d="M285.273 99.7841C285.273 99.7841 299.28 90.7879 312.689 97.6367C326.098 104.486 340.105 95.4893 340.105 95.4893" />
                    <path strokeLinecap="round" strokeWidth={3} strokeOpacity="0.3" d="M281.133 64.9917C281.133 64.9917 287.96 49.8089 302.934 48.2295C317.908 46.6501 319.712 36.5272 319.712 36.5272" />
                    <path strokeLinecap="round" strokeWidth={3} strokeOpacity="0.3" d="M281.133 138.984C281.133 138.984 287.96 154.167 302.934 155.746C317.908 157.326 319.712 167.449 319.712 167.449" />
                    <path strokeLinecap="round" strokeWidth={3} d="M230.578 57.4476C230.578 57.4476 225.785 41.5051 236.061 30.4998C246.337 19.4945 244.686 12.9998 244.686 12.9998" />
                    <path strokeLinecap="round" strokeWidth={3} d="M230.578 150.528C230.578 150.528 225.785 166.471 236.061 177.476C246.337 188.481 244.686 194.976 244.686 194.976" />
                    <path strokeLinecap="round" strokeWidth={3} strokeOpacity="0.3" d="M170.392 57.0278C170.392 57.0278 173.89 42.1322 169.571 29.54C165.252 16.9478 168.751 2.05227 168.751 2.05227" />
                    <path strokeLinecap="round" strokeWidth={3} strokeOpacity="0.3" d="M170.392 150.948C170.392 150.948 173.89 165.844 169.571 178.436C165.252 191.028 168.751 205.924 168.751 205.924" />
                    <path strokeLinecap="round" strokeWidth={3} d="M112.609 57.4476C112.609 57.4476 117.401 41.5051 107.125 30.4998C96.8492 19.4945 98.5 12.9998 98.5 12.9998" />
                    <path strokeLinecap="round" strokeWidth={3} d="M112.609 150.528C112.609 150.528 117.401 166.471 107.125 177.476C96.8492 188.481 98.5 194.976 98.5 194.976" />
                    <path strokeLinecap="round" strokeWidth={3} strokeOpacity="0.3" d="M62.2941 64.9917C62.2941 64.9917 55.4671 49.8089 40.4932 48.2295C25.5194 46.6501 23.7159 36.5272 23.7159 36.5272" />
                    <path strokeLinecap="round" strokeWidth={3} strokeOpacity="0.3" d="M62.2941 145.984C62.2941 145.984 55.4671 161.167 40.4932 162.746C25.5194 164.326 23.7159 174.449 23.7159 174.449" />
                </svg>

                {/* Sparkle Particles - Hydration safe */}
                {sparkles.map((s) => (
                    <div
                        key={s.id}
                        className="sparkle-particle"
                        style={{
                            top: s.top,
                            left: s.left,
                            animationDelay: s.delay
                        }}
                    />
                ))}

                <div className="wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 221 56" height={56} width={221} className="path">
                        <path
                            strokeLinecap="round"
                            strokeWidth={3}
                            d="M 20,2 H 201 A 18,18 0 0 1 219,20 V 36 A 18,18 0 0 1 201,54 H 20 A 18,18 0 0 1 2,36 V 20 A 18,18 0 0 1 20,2"
                        />
                    </svg>
                    <div className="content-3d">
                        <div className="char state-1">
                            {renderChars(text)}
                        </div>
                        <div className="char state-2">
                            {renderChars(text)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
