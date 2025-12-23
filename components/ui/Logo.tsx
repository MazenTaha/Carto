'use client';

import Image from 'next/image';

interface LogoProps {
    width?: number;
    height?: number;
    className?: string;
    variant?: 'white' | 'dark' | 'green';
}

export function Logo({
    width = 150,
    height = 50,
    className = "",
    variant = 'green'
}: LogoProps) {
    // Use the same logo image for all variants currently as it has its own branding
    return (
        <div className={`flex items-center ${className}`}>
            <Image
                src="/images/logo.png"
                alt="Carto Logo"
                width={width}
                height={height}
                className="object-contain"
                priority
            />
        </div>
    );
}
