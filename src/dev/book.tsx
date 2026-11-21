// Dev page for Pip's book: dev-book.html?art=1 shows the pixel art; otherwise the book opens over a
// plain night background with a seeded save (see bookpage.tsx for the query params).
import { showArt } from './bookart.ts';

const q = new URLSearchParams(location.search);
if (q.get('art')) showArt(document.getElementById('ui')!);
else void import('./bookpage.tsx');
