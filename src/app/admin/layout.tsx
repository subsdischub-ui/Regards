import { getAdminSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await getAdminSession();

  // Allow login page without auth
  return <>{children}</>;
}