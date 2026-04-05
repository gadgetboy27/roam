import { useState, useRef } from "react";
import { ExternalLink, Sparkles } from "lucide-react";

export type LiveAd = {
  id: string;
  advertiserName: string;
  advertiserEmail: string;
  advertiserCompany?: string | null;
  tier: string;
  headline: string;
  tagline?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  contentType: string;
};

type Props = {
  ad: LiveAd;
  onDismiss: () => void;
  dragOffset?: number;
  dragOffsetY?: number;
  exitDir?: "left" | "right" | "up" | null;
  onDragStart?: (x: number, y: number) => void;
  onDragMove?: (dx: number, dy: number) => void;
  onDragEnd?: () => void;
};

function isYouTube(url: string) { return /youtu(\.be|be\.com)/.test(url); }
function isVimeo(url: string) { return /vimeo\.com/.test(url); }
function youtubeId(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
function vimeoId(url: string) {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

export default function AdCard({ ad, onDismiss, dragOffset = 0, dragOffsetY = 0, exitDir, onDragStart, onDragMove, onDragEnd }: Props) {
  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const isMouseDown = useRef(false);

  const rotate = dragOffset * 0.06;
  let tx = dragOffset, ty = dragOffsetY;
  if (exitDir === "left")  { tx = -600; ty = 80;  }
  if (exitDir === "right") { tx = 600;  ty = 80;  }
  if (exitDir === "up")    { tx = 0;    ty = -800; }

  const tilt = dragOffset > 0
    ? `rgba(200,230,74,${Math.min(Math.abs(dragOffset) / 200, 0.45)})`
    : `rgba(255,100,60,${Math.min(Math.abs(dragOffset) / 200, 0.35)})`;

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartX.current = e.touches[0].clientX;
    dragStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartX.current === null) return;
    onDragMove?.(e.touches[0].clientX - dragStartX.current, e.touches[0].clientY - (dragStartY.current ?? 0));
  };
  const handleTouchEnd = () => { onDragEnd?.(); dragStartX.current = null; dragStartY.current = null; };
  const handleMouseDown = (e: React.MouseEvent) => { isMouseDown.current = true; dragStartX.current = e.clientX; dragStartY.current = e.clientY; };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current || dragStartX.current === null) return;
    onDragMove?.(e.clientX - dragStartX.current, e.clientY - (dragStartY.current ?? 0));
  };
  const handleMouseUp = () => { isMouseDown.current = false; onDragEnd?.(); };
  const handleMouseLeave = () => { if (isMouseDown.current) { isMouseDown.current = false; onDragEnd?.(); } };

  const hasVideo = ad.contentType === "video" && ad.videoUrl;
  const ytId = hasVideo && ad.videoUrl && isYouTube(ad.videoUrl) ? youtubeId(ad.videoUrl) : null;
  const viId = hasVideo && ad.videoUrl && isVimeo(ad.videoUrl) ? vimeoId(ad.videoUrl) : null;
  const isDirectVideo = hasVideo && !ytId && !viId;

  return (
    <div
      className="absolute inset-0 select-none cursor-grab active:cursor-grabbing"
      style={{
        transform: `translate(${tx}px, ${ty}px) rotate(${rotate}deg)`,
        transition: exitDir ? "transform 0.32s cubic-bezier(0.4,0,0.2,1)" : "none",
        zIndex: 20,
        borderRadius: "24px",
        overflow: "hidden",
        touchAction: "none",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      data-testid="ad-card"
    >
      {/* Media background */}
      <div className="absolute inset-0">
        {ytId ? (
          <iframe
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&loop=1&playlist=${ytId}&controls=0`}
            className="w-full h-full"
            style={{ border: "none", pointerEvents: "none" }}
            allow="autoplay"
          />
        ) : viId ? (
          <iframe
            src={`https://player.vimeo.com/video/${viId}?autoplay=1&muted=1&loop=1&controls=0`}
            className="w-full h-full"
            style={{ border: "none", pointerEvents: "none" }}
            allow="autoplay"
          />
        ) : isDirectVideo && ad.videoUrl ? (
          <video
            src={ad.videoUrl}
            autoPlay muted loop playsInline
            className="w-full h-full object-cover"
          />
        ) : ad.imageUrl ? (
          <img src={ad.imageUrl} alt={ad.headline} className="w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #1a2e1a 0%, #0d1f1a 100%)" }} />
        )}
      </div>

      {/* Tilt overlay */}
      {Math.abs(dragOffset) > 10 && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: tilt, borderRadius: "24px" }} />
      )}

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 40%, rgba(0,0,0,0.7) 75%, rgba(0,0,0,0.92) 100%)" }} />

      {/* Sponsored badge */}
      <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full"
           style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(200,230,74,0.4)" }}>
        <Sparkles size={10} style={{ color: "#c8e64a" }} />
        <span className="font-mono text-[9px] tracking-[0.15em] uppercase" style={{ color: "#c8e64a" }}>Sponsored</span>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-7 pt-6">
        {ad.advertiserCompany && (
          <div className="font-mono text-[9px] tracking-[0.18em] uppercase mb-2"
               style={{ color: "rgba(200,230,74,0.7)" }}>
            {ad.advertiserCompany}
          </div>
        )}
        <h2 className="font-serif text-[26px] font-black leading-tight mb-1.5"
            style={{ color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
          {ad.headline}
        </h2>
        {ad.tagline && (
          <p className="font-mono text-[11px] leading-relaxed mb-4"
             style={{ color: "rgba(255,255,255,0.65)" }}>
            {ad.tagline}
          </p>
        )}

        {ad.ctaUrl && ad.ctaText && (
          <a
            href={ad.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => {
              e.stopPropagation();
              fetch(`/api/ads/${ad.id}/click`, { method: "POST" }).catch(() => {});
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-mono text-[11px] tracking-wider font-semibold"
            style={{ background: "#c8e64a", color: "#0e1a0e" }}
            data-testid="ad-cta-button">
            {ad.ctaText}
            <ExternalLink size={11} />
          </a>
        )}

        <div className="mt-3 font-mono text-[9px] tracking-wider text-center"
             style={{ color: "rgba(255,255,255,0.25)" }}>
          swipe to continue
        </div>
      </div>
    </div>
  );
}
