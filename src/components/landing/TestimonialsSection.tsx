import { Star, Quote } from "lucide-react";
import { motion } from "framer-motion";
import { TextReveal, ScrollFade, TiltCard, AnimatedCounter, LineReveal } from "./ScrollAnimations";

const TestimonialsSection = () => {
  const testimonials = [
    {
      quote: "We went from 14-hour days to actually having weekends again. Veylodesk completely transformed how we manage our agency.",
      author: "Marcus Chen",
      role: "Founder, Pixel Motion Studios",
      avatar: "MC",
      rating: 5,
    },
    {
      quote: "My clients love the portal. They can see exactly where their project is without 15 Slack messages. Game-changer for client retention.",
      author: "Sarah Williams",
      role: "CEO, Elevate Video Co",
      avatar: "SW",
      rating: 5,
    },
    {
      quote: "Finally, a tool built by someone who actually runs an agency. Everything just makes sense. No more spreadsheet nightmares.",
      author: "David Park",
      role: "Creative Director, Framehaus",
      avatar: "DP",
      rating: 5,
    },
  ];

  const stats = [
    { value: 500, suffix: "+", label: "Agencies Trust Us" },
    { value: 50, suffix: "K+", label: "Projects Managed" },
    { value: 12, suffix: "hrs", label: "Saved Per Week" },
    { value: 99.9, suffix: "%", label: "Uptime SLA" },
  ];

  return (
    <section id="testimonials" className="relative py-32 lg:py-44 overflow-hidden">
      {/* Cinematic Background */}
      <div className="absolute inset-0 bg-gradient-section" />
      <LineReveal className="absolute top-0 left-0 right-0" />
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-gradient-glow-soft rounded-full blur-[120px]" />

      <div className="container relative z-10 mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-24">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-8">
            <TextReveal staggerDelay={0.04}>Built by Agency Owners,</TextReveal>{" "}
            <TextReveal staggerDelay={0.04} gradient>for Agency Owners</TextReveal>
          </h2>
          <ScrollFade delay={0.2}>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Join hundreds of video agencies who've reclaimed their time and sanity.
            </p>
          </ScrollFade>
        </div>

        {/* Testimonial Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-28">
          {testimonials.map((testimonial, index) => (
            <ScrollFade key={testimonial.author} delay={index * 0.15} direction={index === 0 ? "left" : index === 2 ? "right" : "up"}>
              <TiltCard intensity={6}>
                <div className="glass-card-premium rounded-3xl p-10 hover:border-primary/20 transition-all duration-300 group h-full">
                  {/* Quote Icon */}
                  <motion.div 
                    className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-8 group-hover:bg-primary/20 transition-colors duration-300"
                    whileHover={{ rotate: 10, scale: 1.1 }}
                  >
                    <Quote className="w-6 h-6 text-primary" />
                  </motion.div>

                  {/* Stars */}
                  <div className="flex gap-1 mb-6">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0, rotate: -180 }}
                        whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
                      >
                        <Star className="w-5 h-5 fill-warning text-warning" />
                      </motion.div>
                    ))}
                  </div>

                  {/* Quote */}
                  <p className="text-lg text-foreground mb-8 leading-relaxed">
                    "{testimonial.quote}"
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-lg shadow-lg shadow-primary/30">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{testimonial.author}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </div>
              </TiltCard>
            </ScrollFade>
          ))}
        </div>

        {/* Stats with animated counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 max-w-4xl mx-auto">
          {stats.map((stat, index) => (
            <ScrollFade key={stat.label} delay={index * 0.1}>
              <div className="text-center">
                <p className="text-4xl md:text-5xl font-bold text-gradient mb-3 tracking-tight">
                  <AnimatedCounter 
                    target={stat.value} 
                    suffix={stat.suffix} 
                    duration={2} 
                  />
                </p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </ScrollFade>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
