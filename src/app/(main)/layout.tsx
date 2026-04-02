import BottomNav from '@/components/bottom-nav';
import ToastProvider from '@/components/toast';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-20">
      <ToastProvider />
      {children}
      <BottomNav />
    </div>
  );
}