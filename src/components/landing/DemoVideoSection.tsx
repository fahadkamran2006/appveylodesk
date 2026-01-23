import { motion } from "framer-motion";
import { Play } from "lucide-react";

const DemoVideoSection = () => {
  return (
    <section id="demo" className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px]" />
      
      <div className="container relative z-10 mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Play className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">See It In Action</span>
          </div>
          
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Watch How <span className="text-gradient">Veylodesk Works</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Take a quick tour of the command center built for video agencies. 
            See how you can manage clients, editors, and projects—all in one place.
          </p>
        </motion.div>

        {/* Video Container */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="max-w-5xl mx-auto"
        >
          <div className="relative">
            {/* Glow Effect */}
            <div className="absolute -inset-6 bg-gradient-to-r from-primary/20 via-indigo-soft/15 to-primary/20 rounded-3xl blur-2xl opacity-60" />
            <div className="absolute -inset-3 bg-gradient-glow rounded-3xl opacity-40" />
            
            {/* Video Frame */}
            <div className="relative glass-card-premium rounded-2xl p-2 overflow-hidden shadow-2xl">
              <div className="relative rounded-xl overflow-hidden bg-midnight-deep aspect-video">
                <iframe
                  src="https://www.youtube.com/embed/GdBbO1Svbxk"
                  title="Veylodesk Demo Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default DemoVideoSection;
