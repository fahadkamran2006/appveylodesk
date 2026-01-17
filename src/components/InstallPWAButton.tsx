import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

interface InstallPWAButtonProps {
  variant?: 'default' | 'compact' | 'banner';
  className?: string;
}

export function InstallPWAButton({ variant = 'default', className }: InstallPWAButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if running as PWA on iOS
    if ((navigator as any).standalone === true) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Don't render if already installed or no prompt available
  if (isInstalled) {
    return null;
  }

  // For mobile browsers that don't support beforeinstallprompt (like Safari)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const showIOSInstructions = isIOS && !deferredPrompt;

  if (!deferredPrompt && !showIOSInstructions) {
    return null;
  }

  if (variant === 'banner' && showBanner) {
    return (
      <div className={cn(
        "fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-40 animate-fade-up",
        className
      )}>
        <div className="bg-surface-dark border border-border rounded-2xl p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-foreground text-sm">Install Veylodesk</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {showIOSInstructions 
                  ? "Tap Share then 'Add to Home Screen'" 
                  : "Install for quick access and offline use"}
              </p>
            </div>
            <button
              onClick={() => setShowBanner(false)}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {!showIOSInstructions && (
            <Button
              variant="hero"
              size="sm"
              className="w-full mt-3"
              onClick={handleInstallClick}
            >
              <Download className="w-4 h-4 mr-2" />
              Install App
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={showIOSInstructions ? undefined : handleInstallClick}
        className={cn("gap-2", className)}
        title={showIOSInstructions ? "Use Safari Share menu to install" : "Install app"}
      >
        <Download className="w-4 h-4" />
        Install
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={showIOSInstructions ? undefined : handleInstallClick}
      className={cn("gap-2", className)}
    >
      <Download className="w-4 h-4" />
      {showIOSInstructions ? "Add to Home Screen" : "Install App"}
    </Button>
  );
}
