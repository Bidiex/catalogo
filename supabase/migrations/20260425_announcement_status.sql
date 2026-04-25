-- 1. Create table to track user interaction with announcements
CREATE TABLE IF NOT EXISTS public.user_announcement_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_seen BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT false,
    is_dismissed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(announcement_id, user_id)
);

-- Enable RLS
ALTER TABLE public.user_announcement_status ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist so we can recreate them without errors
DROP POLICY IF EXISTS "Users can view their own announcement statuses" ON public.user_announcement_status;
DROP POLICY IF EXISTS "Users can insert their own announcement statuses" ON public.user_announcement_status;
DROP POLICY IF EXISTS "Users can update their own announcement statuses" ON public.user_announcement_status;

-- Users can only see and manage their own statuses
CREATE POLICY "Users can view their own announcement statuses" 
    ON public.user_announcement_status FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own announcement statuses" 
    ON public.user_announcement_status FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own announcement statuses" 
    ON public.user_announcement_status FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- 2. Create RPCs for the JS frontend to call

-- Mark as SEEN (When the modal pops up)
CREATE OR REPLACE FUNCTION public.mark_announcement_seen(p_announcement_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_announcement_status (announcement_id, user_id, is_seen, updated_at)
  VALUES (p_announcement_id, auth.uid(), true, now())
  ON CONFLICT (announcement_id, user_id) 
  DO UPDATE SET is_seen = true, updated_at = now();
END;
$$;

-- Mark as DISMISSED (When user closes the modal without clicking CTA)
CREATE OR REPLACE FUNCTION public.mark_announcement_dismissed(p_announcement_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_announcement_status (announcement_id, user_id, is_dismissed, updated_at)
  VALUES (p_announcement_id, auth.uid(), true, now())
  ON CONFLICT (announcement_id, user_id) 
  DO UPDATE SET is_dismissed = true, updated_at = now();
END;
$$;

-- Mark as READ (When user clicks the CTA button)
CREATE OR REPLACE FUNCTION public.mark_announcement_read(p_announcement_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_announcement_status (announcement_id, user_id, is_read, updated_at)
  VALUES (p_announcement_id, auth.uid(), true, now())
  ON CONFLICT (announcement_id, user_id) 
  DO UPDATE SET is_read = true, updated_at = now();
END;
$$;

-- 3. Grants para asegurar que PostgREST pueda llamarlas
GRANT EXECUTE ON FUNCTION public.mark_announcement_seen(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_announcement_dismissed(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_announcement_read(UUID) TO anon, authenticated;

-- 4. Forzar que Supabase (PostgREST) recargue la caché de esquemas y funciones
NOTIFY pgrst, 'reload schema';
