import { useState } from "react";
import { Play } from "lucide-react";
import { TextReveal, ScrollFade, TiltCard, LineReveal } from "./ScrollAnimations";

const VIDEO_ID = "v0sQxRYuzTo";
const VIDEO_TITLE = "Veylodesk Demo — Client Portal, Video Approvals & Pay-to-Download for Video Agencies";
const VIDEO_DESCRIPTION =
  "Watch the full Veylodesk demo: a white-labeled client portal, frame-accurate video approvals, and a pay-to-download invoicing system built for modern video agencies.";
const THUMBNAIL = `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`;

const DemoVideoSection = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Autoplay + muted on first click for smooth playback (browsers block autoplay with sound)
  const embedSrc = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1&controls=1`;

  // SEO: VideoObject structured data
  const videoSchema = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: VIDEO_TITLE,
    description: VIDEO_DESCRIPTION,
    thumbnailUrl: [THUMBNAIL],
    uploadDate: "2025-01-01",
    contentUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    embedUrl: `https://www.youtube.com/embed/${VIDEO_ID}`,
    publisher: {
      "@type": "Organization",
      name: "Veylodesk",
    },
  };

  return (
    <section
      id="demo"
      aria-labelledby="demo-heading"
      className="relative py-16 sm:py-20 md:py-24 overflow-hidden"
    >
      {/* SEO structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoSchema) }}
      />

      {/* Background */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <LineReveal className="absolute top-0 left-0 right-0" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[800px] h-[500px] sm:h-[800px] bg-primary/5 rounded-full blur-[100px] sm:blur-[150px]" />

      <div className="container relative z-10 mx-auto px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12">
          <ScrollFade>
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 border border-primary/20 mb-4 sm:mb-6">
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
              <span className="text-xs sm:text-sm font-medium text-primary">See It In Action</span>
            </div>
          </ScrollFade>

          <h2
            id="demo-heading"
            className="text-[1.75rem] leading-[1.15] sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6"
          >
            <TextReveal staggerDelay={0.04}>Watch the</TextReveal>{" "}
            <TextReveal staggerDelay={0.04} gradient>Veylodesk Demo</TextReveal>
          </h2>
          <ScrollFade delay={0.2}>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
              See how video agencies use Veylodesk to manage clients, approve
              edits frame-by-frame, and get paid before files leave the
              platform — all in one tab.
            </p>
          </ScrollFade>
        </div>

        {/* Video Container with 3D tilt */}
        <ScrollFade delay={0.3}>
          <div className="max-w-5xl mx-auto">
            <TiltCard intensity={5}>
              <div className="relative">
                {/* Glow Effect */}
                <div className="absolute -inset-3 sm:-inset-6 bg-gradient-to-r from-primary/20 via-indigo-soft/15 to-primary/20 rounded-2xl sm:rounded-3xl blur-xl sm:blur-2xl opacity-60" />
                <div className="absolute -inset-1.5 sm:-inset-3 bg-gradient-glow rounded-2xl sm:rounded-3xl opacity-40" />

                {/* Video Frame */}
                <div className="relative glass-card-premium rounded-xl sm:rounded-2xl p-1.5 sm:p-2 overflow-hidden shadow-2xl">
                  <div className="relative rounded-lg sm:rounded-xl overflow-hidden bg-midnight-deep aspect-video">
                    {!isPlaying ? (
                      <button
                        type="button"
                        onClick={() => setIsPlaying(true)}
                        aria-label={`Play Veylodesk demo video: ${VIDEO_TITLE}`}
                        className="group absolute inset-0 w-full h-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <img
                          src={THUMBNAIL}
                          alt="Veylodesk product demo video thumbnail showing the agency dashboard"
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        {/* Dark overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-midnight-deep/80 via-midnight-deep/20 to-transparent" />

                        {/* Play button */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="relative">
                            <div className="absolute inset-0 rounded-full bg-primary/40 blur-2xl scale-150 animate-pulse-glow" />
                            <div className="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-primary text-primary-foreground shadow-2xl transition-transform duration-300 group-hover:scale-110">
                              <Play className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 ml-1 fill-current" />
                            </div>
                          </div>
                        </div>

                        {/* Caption at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-5 text-left">
                          <p className="text-[10px] sm:text-xs uppercase tracking-widest text-primary/80 mb-1">
                            Product Demo · 3 min
                          </p>
                          <p className="text-sm sm:text-base md:text-lg font-semibold text-white line-clamp-2">
                            Veylodesk for Video Agencies
                          </p>
                        </div>
                      </button>
                    ) : (
                      <iframe
                        src={embedSrc}
                        title={VIDEO_TITLE}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        loading="lazy"
                        className="absolute inset-0 w-full h-full"
                      />
                    )}
                  </div>
                </div>
              </div>
            </TiltCard>
          </div>
        </ScrollFade>
      </div>
    </section>
  );
};

export default DemoVideoSection;
