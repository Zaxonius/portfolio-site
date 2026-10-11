// Upload sequentially to keep large originals out of memory and retain successful saves on retry.
export async function publishBatch(items, { compress, upload, publish, onChange = () => {}, canContinue = () => true }) {
  for (const item of items) {
    if (item.state === 'published') continue;
    if (!canContinue()) break;
    try {
      item.error = '';
      if (!item.url) {
        item.state = 'compressing'; onChange(item);
        const blob = await compress(item.file);
        item.state = 'uploading'; onChange(item);
        item.url = await upload(blob);
      }
      item.state = 'publishing'; onChange(item);
      await publish(item);
      item.state = 'published';
    } catch (error) { item.state = 'failed'; item.error = error.message; }
    onChange(item);
  }
}

export async function applyPhotoChanges(photos, scope, { caption, memberships }, api, onProgress = () => {}) {
  const listings = new Map();
  for (const change of memberships) {
    const result = await api('/galleries/' + encodeURIComponent(change.slug));
    listings.set(change.slug, result.photos);
  }
  const failed = [];
  let completed = 0;
  for (const photo of photos) {
    try {
      const base = scope ? '/galleries/' + encodeURIComponent(scope) + '/photos' : '/photos';
      const removedFromSource = memberships.some(change => change.slug === scope && change.action === 'remove') && !listings.get(scope)?.some(p => p.url === photo.url);
      if (caption !== undefined && !removedFromSource) await api(base + '/' + encodeURIComponent(photo.id), { method: 'PATCH', body: JSON.stringify({ description: caption }) });
      for (const change of memberships) {
        const list = listings.get(change.slug);
        const existing = list.find(p => p.url === photo.url);
        const endpoint = '/galleries/' + encodeURIComponent(change.slug) + '/photos';
        if (change.action === 'add' && !existing) {
          const saved = await api(endpoint, { method: 'POST', body: JSON.stringify({ url: photo.url, description: caption ?? photo.description ?? '' }) });
          list.push(saved);
        } else if (change.action === 'remove' && existing) {
          await api(endpoint + '/' + encodeURIComponent(existing.id), { method: 'DELETE' });
          list.splice(list.indexOf(existing), 1);
        }
      }
      completed++;
    } catch (error) { failed.push({ photo, error: error.message }); }
    onProgress(completed, failed.length);
  }
  return { completed, failed };
}
