// Simple deterministic avatar: initials + a color derived from the username,
// so the same user always gets the same look without needing an image upload.
const PALETTE = [
  ['#8b5cf6', '#38bdf8'], ['#f472b6', '#8b5cf6'], ['#38bdf8', '#34d399'],
  ['#fbbf24', '#f472b6'], ['#34d399', '#38bdf8'], ['#a78bfa', '#f472b6'],
]

export function initialsFor(name){
  if(!name) return '?'
  const parts = name.trim().split(/[\s_.-]+/).filter(Boolean)
  if(parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function gradientFor(name){
  if(!name) return PALETTE[0]
  let hash = 0
  for(let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}
