import cookie from 'cookie';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function authorize(req) {
  const cookies = req.headers.cookie ? cookie.parse(req.headers.cookie) : {};
  const token = cookies.session_token;

  if (!token) return null;

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('session_token', token)
    .single();

  if (error) {
    console.error('Authorize error:', error.message);
    return null;
  }

  return user;
}
