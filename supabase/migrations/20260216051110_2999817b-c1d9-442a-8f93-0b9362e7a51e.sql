
-- Drop the trigger that uses pg_net (which doesn't exist on this instance)
DROP TRIGGER IF EXISTS on_notification_send_web_push ON public.notifications;
DROP FUNCTION IF EXISTS public.trigger_web_push_notification();
