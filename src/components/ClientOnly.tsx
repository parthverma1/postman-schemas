import { useEffect, useState, type ReactNode } from 'react';

/**
 * Renders children only after the component has mounted on the client.
 * Prevents server-side rendering of browser-only components.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return <>{mounted ? children : fallback}</>;
}
