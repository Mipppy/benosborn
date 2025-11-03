import { createClient } from '@supabase/supabase-js';
import { authorize } from './helpers.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await authorize(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { title, text_body, tags, internal_name } = req.body;

    if (!title || !text_body || !internal_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let tagsString = '';
    if (tags) {
      if (Array.isArray(tags)) tagsString = tags.map(t => t.trim()).filter(Boolean).join(',');
      else tagsString = tags.split(',').map(t => t.trim()).filter(Boolean).join(',');
    }

    const { data, error } = await supabase
      .from('text')
      .insert({ title, text_body, tags: tagsString, internal_name })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
