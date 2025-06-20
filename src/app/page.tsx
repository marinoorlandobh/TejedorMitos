import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/create');
  return null; // Or a loading spinner, but redirect is cleaner for SPA-like experience
}
