import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import { authorize } from './helpers.js';
import { promisify } from 'util';
import sharp from 'sharp';

export const config = { api: { bodyParser: false } };

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);


export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const user = await authorize(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const form = formidable({ multiples: false });
  const parseForm = promisify(form.parse.bind(form));

  try {
    await parseForm(req);
    const fields = form.fields;
    const files = form.openedFiles;

    let uploadedFile;
    if (files) {
      const fileKeys = Object.keys(files);
      if (fileKeys.length > 0) uploadedFile = files[fileKeys[0]];
    }

    if (!uploadedFile) return res.status(400).json({ error: 'No file uploaded' });

    const fileBuffer = fs.readFileSync(uploadedFile.filepath);
    const timestamp = Date.now();
    const supabaseFilePath = `images/${timestamp}-${uploadedFile.originalFilename}`;
    const thumbnailBuffer = await sharp(fileBuffer).resize({ width: 200 }).toBuffer();
    const supabaseThumbnailPath = `thumbnails/${timestamp}-${uploadedFile.originalFilename}`;

    const { error: uploadError } = await supabase.storage
      .from('gallery')
      .upload(supabaseFilePath, fileBuffer, { contentType: uploadedFile.mimetype || 'application/octet-stream' });

    if (uploadError) return res.status(500).json({ error: uploadError.message });

    const { error: thumbError } = await supabase.storage
      .from('gallery')
      .upload(supabaseThumbnailPath, thumbnailBuffer, { contentType: uploadedFile.mimetype || 'application/octet-stream' });

    if (thumbError) return res.status(500).json({ error: thumbError.message });

    const publicUrl = supabase.storage.from('gallery').getPublicUrl(supabaseFilePath).data.publicUrl;

    const { data, error: dbError } = await supabase
      .from('images')
      .insert({ url: publicUrl, storage_path: supabaseFilePath, title: fields.title || 'Untitled', description: fields.description || '', tags: fields.tags || '' })
      .select()
      .single();

    if (dbError) return res.status(500).json({ error: dbError.message });

    res.status(200).json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
