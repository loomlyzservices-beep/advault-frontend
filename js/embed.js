// Detects the kind of media a URL points to, so the ad player knows how to render it.
export function detectMediaType(url){
  if(!url) return null
  if(url.startsWith('data:video/')) return 'video'
  if(url.startsWith('data:image/')) return 'image'
  if(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{6,})/.test(url)) return 'youtube'
  if(/vimeo\.com\/(\d+)/.test(url)) return 'vimeo'
  if(/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url)) return 'video'
  if(/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url)) return 'image'
  return 'link'
}

export function toEmbedUrl(url){
  if(!url) return null
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{6,})/)
  if(yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&mute=1`

  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if(vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&muted=1`

  return null
}

export function isImageUrl(url){
  return detectMediaType(url) === 'image'
}

export function isDirectVideoUrl(url){
  return detectMediaType(url) === 'video'
}
