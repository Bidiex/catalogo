-- Migration to add downgrade_to_trial_plus RPC
CREATE OR REPLACE FUNCTION downgrade_to_trial_plus()
    RETURNS boolean AS $$
DECLARE
    v_business_id uuid;
BEGIN
    SELECT id INTO v_business_id FROM public.businesses WHERE user_id = auth.uid() 
      AND plan_type = 'pro' AND is_active = false;
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    UPDATE public.businesses
    SET plan_type = 'plus',
        is_active = true,
        plan_expires_at = (NOW() + INTERVAL '30 days')::timestamp,
        plan_renewed_at = NOW()::timestamp,
        monthly_orders_count = 0
    WHERE id = v_business_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
