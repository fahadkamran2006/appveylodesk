
-- Create a function that sends web push notifications via the edge function
-- This will be called by a trigger on the notifications table
CREATE OR REPLACE FUNCTION public.trigger_web_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Call the edge function asynchronously via pg_net
  PERFORM net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/send-web-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'link', NEW.link,
      'type', NEW.type
    )
  );
  
  RETURN NEW;
END;
$function$;

-- Create trigger to send web push on notification insert
CREATE TRIGGER on_notification_send_web_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_web_push_notification();
