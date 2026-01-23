-- Create a function to log activities
CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _action text;
  _details jsonb;
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    _action := 'created';
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'updated';
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'deleted';
  END IF;

  -- Build details based on table
  CASE TG_TABLE_NAME
    WHEN 'leave_requests' THEN
      IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
        _action := NEW.status; -- 'approved', 'rejected', etc.
      END IF;
      SELECT jsonb_build_object(
        'employee_name', e.first_name || ' ' || e.last_name,
        'leave_type', lt.name,
        'days', COALESCE(NEW.days_count, OLD.days_count)
      ) INTO _details
      FROM employees e
      LEFT JOIN leave_types lt ON lt.id = COALESCE(NEW.leave_type_id, OLD.leave_type_id)
      WHERE e.id = COALESCE(NEW.employee_id, OLD.employee_id);
      
    WHEN 'employees' THEN
      _details := jsonb_build_object(
        'name', COALESCE(NEW.first_name, OLD.first_name) || ' ' || COALESCE(NEW.last_name, OLD.last_name),
        'employee_code', COALESCE(NEW.employee_code, OLD.employee_code)
      );
      IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
        _action := 'status changed to ' || NEW.status;
      END IF;
      
    WHEN 'asset_assignments' THEN
      SELECT jsonb_build_object(
        'employee_name', e.first_name || ' ' || e.last_name,
        'asset_name', a.name
      ) INTO _details
      FROM employees e, assets a
      WHERE e.id = COALESCE(NEW.employee_id, OLD.employee_id)
        AND a.id = COALESCE(NEW.asset_id, OLD.asset_id);
      IF NEW.returned_date IS NOT NULL AND OLD.returned_date IS NULL THEN
        _action := 'returned';
      ELSIF TG_OP = 'INSERT' THEN
        _action := 'assigned';
      END IF;
      
    WHEN 'performance_reviews' THEN
      SELECT jsonb_build_object(
        'employee_name', e.first_name || ' ' || e.last_name,
        'review_period', COALESCE(NEW.review_period, OLD.review_period),
        'rating', COALESCE(NEW.overall_rating, OLD.overall_rating)
      ) INTO _details
      FROM employees e
      WHERE e.id = COALESCE(NEW.employee_id, OLD.employee_id);
      IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
        _action := NEW.status;
      END IF;
      
    WHEN 'attendance_records' THEN
      SELECT jsonb_build_object(
        'employee_name', e.first_name || ' ' || e.last_name,
        'date', COALESCE(NEW.date, OLD.date)::text
      ) INTO _details
      FROM employees e
      WHERE e.id = COALESCE(NEW.employee_id, OLD.employee_id);
      IF TG_OP = 'UPDATE' AND NEW.clock_out IS NOT NULL AND OLD.clock_out IS NULL THEN
        _action := 'clocked out';
      ELSIF TG_OP = 'INSERT' THEN
        _action := 'clocked in';
      END IF;
      
    ELSE
      _details := jsonb_build_object('table', TG_TABLE_NAME);
  END CASE;

  -- Add performed_by info
  IF _user_id IS NOT NULL THEN
    SELECT _details || jsonb_build_object(
      'performed_by', e.first_name || ' ' || e.last_name
    ) INTO _details
    FROM employees e
    WHERE e.user_id = _user_id;
  END IF;

  -- Insert the activity log
  INSERT INTO public.activity_logs (
    action,
    entity_type,
    entity_id,
    user_id,
    details
  ) VALUES (
    _action,
    TG_TABLE_NAME,
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    _user_id,
    _details
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

-- Create triggers for key tables
CREATE TRIGGER log_leave_request_activity
  AFTER INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.log_activity();

CREATE TRIGGER log_employee_activity
  AFTER INSERT OR UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.log_activity();

CREATE TRIGGER log_asset_assignment_activity
  AFTER INSERT OR UPDATE ON public.asset_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_activity();

CREATE TRIGGER log_performance_review_activity
  AFTER INSERT OR UPDATE ON public.performance_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.log_activity();

CREATE TRIGGER log_attendance_activity
  AFTER INSERT OR UPDATE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.log_activity();