import { useEffect } from "react";
import { Loader2 } from "lucide-react";

/**
 * Proxy component for OAuth initiation paths.
 * 
 * On published custom domains, the OAuth broker paths (/~oauth/initiate or /--oauth/initiate)
 * get intercepted by React Router and show a 404. This component catches those routes
 * and redirects to the actual OAuth broker at oauth.lovable.app.
 */
const OAuthInitiateProxy = () => {
  useEffect(() => {
    // Preserve the full query string (contains provider, redirect_uri, state, etc.)
    const queryString = window.location.search;
    const brokerUrl = `https://oauth.lovable.app/~oauth/initiate${queryString}`;
    
    // Use replace so the user can't navigate "back" to this loading page
    window.location.replace(brokerUrl);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground">Redirecting to sign in...</p>
    </div>
  );
};

export default OAuthInitiateProxy;
