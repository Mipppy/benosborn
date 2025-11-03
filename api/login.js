import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

    await supabase.from('users').update({ session_token: token }).eq('id', user.id);
    res.setHeader('Set-Cookie', `session_token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`); // 1 Week
    res.status(200).json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
