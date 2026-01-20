-- Add attachment_url and attachment_type columns to messages table for file attachments
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_type TEXT;

-- Create a function to calculate admin performance metrics
CREATE OR REPLACE FUNCTION public.get_admin_performance_metrics(_agency_id UUID)
RETURNS TABLE(
  total_client_messages BIGINT,
  responded_messages BIGINT,
  reply_rate_percent NUMERIC,
  avg_response_time_seconds NUMERIC,
  avg_response_time_display TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _total_client BIGINT;
  _responded BIGINT;
  _avg_seconds NUMERIC;
BEGIN
  -- Get total client messages in channels belonging to this agency
  SELECT COUNT(*) INTO _total_client
  FROM public.messages m
  JOIN public.channels c ON c.id = m.channel_id
  JOIN public.user_roles ur ON ur.user_id = m.sender_id AND ur.role = 'client'
  WHERE c.agency_id = _agency_id;

  -- Count client messages that have at least one admin/editor reply after them
  WITH client_messages AS (
    SELECT 
      m.id,
      m.channel_id,
      m.created_at,
      m.sender_id
    FROM public.messages m
    JOIN public.channels c ON c.id = m.channel_id
    JOIN public.user_roles ur ON ur.user_id = m.sender_id AND ur.role = 'client'
    WHERE c.agency_id = _agency_id
  ),
  responses AS (
    SELECT DISTINCT cm.id AS client_msg_id
    FROM client_messages cm
    JOIN public.messages resp ON resp.channel_id = cm.channel_id
      AND resp.created_at > cm.created_at
      AND resp.sender_id != cm.sender_id
    JOIN public.user_roles ur ON ur.user_id = resp.sender_id 
      AND ur.role IN ('admin', 'editor')
      AND ur.agency_id = _agency_id
  )
  SELECT COUNT(*) INTO _responded FROM responses;

  -- Calculate average response time
  WITH client_messages AS (
    SELECT 
      m.id,
      m.channel_id,
      m.created_at AS client_time,
      m.sender_id
    FROM public.messages m
    JOIN public.channels c ON c.id = m.channel_id
    JOIN public.user_roles ur ON ur.user_id = m.sender_id AND ur.role = 'client'
    WHERE c.agency_id = _agency_id
  ),
  response_times AS (
    SELECT 
      cm.id,
      MIN(resp.created_at) AS first_response_time,
      cm.client_time
    FROM client_messages cm
    JOIN public.messages resp ON resp.channel_id = cm.channel_id
      AND resp.created_at > cm.client_time
      AND resp.sender_id != cm.sender_id
    JOIN public.user_roles ur ON ur.user_id = resp.sender_id 
      AND ur.role IN ('admin', 'editor')
      AND ur.agency_id = _agency_id
    GROUP BY cm.id, cm.client_time
  )
  SELECT AVG(EXTRACT(EPOCH FROM (first_response_time - client_time))) INTO _avg_seconds
  FROM response_times;

  RETURN QUERY SELECT 
    _total_client,
    _responded,
    CASE WHEN _total_client > 0 
      THEN ROUND((_responded::NUMERIC / _total_client::NUMERIC) * 100, 1)
      ELSE 0 
    END,
    COALESCE(_avg_seconds, 0),
    CASE 
      WHEN _avg_seconds IS NULL THEN 'N/A'
      WHEN _avg_seconds < 60 THEN ROUND(_avg_seconds) || 's'
      WHEN _avg_seconds < 3600 THEN ROUND(_avg_seconds / 60) || 'm'
      WHEN _avg_seconds < 86400 THEN ROUND(_avg_seconds / 3600, 1) || 'h'
      ELSE ROUND(_avg_seconds / 86400, 1) || 'd'
    END;
END;
$$;

-- Create a function to get monthly earnings data for charts
CREATE OR REPLACE FUNCTION public.get_monthly_earnings(_agency_id UUID, _months INTEGER DEFAULT 12)
RETURNS TABLE(
  month TEXT,
  year INTEGER,
  month_num INTEGER,
  earnings NUMERIC,
  projects_completed BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH months AS (
    SELECT 
      TO_CHAR(d, 'Mon') AS month,
      EXTRACT(YEAR FROM d)::INTEGER AS year,
      EXTRACT(MONTH FROM d)::INTEGER AS month_num,
      d AS month_start,
      (d + INTERVAL '1 month' - INTERVAL '1 day')::DATE AS month_end
    FROM generate_series(
      DATE_TRUNC('month', NOW() - (_months - 1 || ' months')::INTERVAL),
      DATE_TRUNC('month', NOW()),
      '1 month'::INTERVAL
    ) d
  )
  SELECT 
    m.month,
    m.year,
    m.month_num,
    COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) AS earnings,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'done' AND p.completed_at >= m.month_start AND p.completed_at < m.month_end + INTERVAL '1 day') AS projects_completed
  FROM months m
  LEFT JOIN public.invoices i ON i.agency_id = _agency_id 
    AND i.paid_at >= m.month_start 
    AND i.paid_at < m.month_end + INTERVAL '1 day'
  LEFT JOIN public.projects p ON p.agency_id = _agency_id
  GROUP BY m.month, m.year, m.month_num, m.month_start, m.month_end
  ORDER BY m.year, m.month_num;
$$;

-- Create a function to get client acquisition data
CREATE OR REPLACE FUNCTION public.get_client_acquisition(_agency_id UUID, _months INTEGER DEFAULT 12)
RETURNS TABLE(
  month TEXT,
  year INTEGER,
  month_num INTEGER,
  new_clients BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH months AS (
    SELECT 
      TO_CHAR(d, 'Mon') AS month,
      EXTRACT(YEAR FROM d)::INTEGER AS year,
      EXTRACT(MONTH FROM d)::INTEGER AS month_num,
      d AS month_start,
      (d + INTERVAL '1 month' - INTERVAL '1 day')::DATE AS month_end
    FROM generate_series(
      DATE_TRUNC('month', NOW() - (_months - 1 || ' months')::INTERVAL),
      DATE_TRUNC('month', NOW()),
      '1 month'::INTERVAL
    ) d
  )
  SELECT 
    m.month,
    m.year,
    m.month_num,
    COUNT(DISTINCT ur.user_id) AS new_clients
  FROM months m
  LEFT JOIN public.user_roles ur ON ur.agency_id = _agency_id 
    AND ur.role = 'client'
    AND ur.created_at >= m.month_start 
    AND ur.created_at < m.month_end + INTERVAL '1 day'
  GROUP BY m.month, m.year, m.month_num
  ORDER BY m.year, m.month_num;
$$;