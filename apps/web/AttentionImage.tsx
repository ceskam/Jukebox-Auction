"use client";

import { useState } from "react";

type Props = {
  alt: string;
  className: string;
  src: string;
};

export default function AttentionImage({ alt, className, src }: Props) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className={`${className} image-fallback`} role="img" aria-label="Image unavailable">
        Image unavailable
      </div>
    );
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
    />
  );
}
