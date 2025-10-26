import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import sharp from 'sharp';
import { time } from 'console';


export const config = { api: { bodyParser: false } };

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const form = formidable({ multiples: false });
    const parseForm = promisify(form.parse.bind(form));

    try {
        const parsedForm = await parseForm(req);
        const fields = form.fields;
        const files = form.openedFiles;

        let uploadedFile;
        if (files) {
            const fileKeys = Object.keys(files);
            if (fileKeys.length > 0) uploadedFile = files[fileKeys[0]];
        }

        if (!uploadedFile) return res.status(400).json({ error: 'No file uploaded' });

        const filePathOnDisk = path.resolve(uploadedFile.filepath);
        if (!fs.existsSync(filePathOnDisk)) {
            return res.status(500).json({ error: 'Uploaded file not found on disk' });
        }

        const title = Array.isArray(fields.title) ? fields.title[0] : fields.title || 'Untitled';
        const description = Array.isArray(fields.description) ? fields.description[0] : fields.description || '';

        let tags = [];
        if (fields.tags) {
            const tagsField = Array.isArray(fields.tags) ? fields.tags[0] : fields.tags;
            tags = tagsField.split(',').map(t => t.trim()).filter(Boolean);
        }
        const timestamp = Date.now()
        const supabaseFilePath = `images/${timestamp}-${uploadedFile.originalFilename}`;
        const fileBuffer = fs.readFileSync(filePathOnDisk);
        const thumbnailBuffer = await sharp(fileBuffer).resize({ width: 200 }).toBuffer();
        const supabaseThumbnailFilePath = `thumbnails/${timestamp}-${uploadedFile.originalFilename}`

        const mimeType = uploadedFile.mimetype || 'application/octet-stream';

        const { error: uploadError } = await supabase.storage
            .from('gallery')
            .upload(supabaseFilePath, fileBuffer, {
                contentType: mimeType,
                upsert: false,
            });

        if (uploadError) return res.status(500).json({ error: uploadError.message });

        const { error: thumbnailUploadError} = await supabase.storage
        .from('gallery')
        .upload(supabaseThumbnailFilePath, thumbnailBuffer, {
            contentType: mimeType,
            upsert: false,
        })
        if (thumbnailUploadError) return res.status(500).json({error: uploadError.message})

        const  publicUrl  = supabase.storage.from('gallery').getPublicUrl(supabaseFilePath).data.publicUrl;
        const { data: dbData, error: dbError } = await supabase
            .from('images')
            .insert({
                url: publicUrl,
                storage_path: supabaseFilePath,
                title,
                description,
                tags,
            })
            .select()
            .single();

        if (dbError) return res.status(500).json({ error: dbError.message });

        res.status(200).json(dbData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
}
