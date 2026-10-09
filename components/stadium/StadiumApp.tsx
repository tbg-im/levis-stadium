'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// WebGL only exists in the browser, so the viewer never renders on the server.
const StadiumViewer = dynamic(() => import('./StadiumViewer'), {
  ssr: false,
  loading: () => (
    <div className="relative h-dvh w-full bg-background p-4">
      <div className="flex gap-3">
        <Skeleton className="h-20 w-56 rounded-lg" />
        <Skeleton className="hidden h-20 w-56 rounded-lg sm:block" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
        Building Levi’s Stadium…
      </div>
    </div>
  ),
});

export default function StadiumApp() {
  return <StadiumViewer />;
}
