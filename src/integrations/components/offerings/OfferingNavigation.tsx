import { createContext, useContext, type ReactNode } from 'react';
export const OfferingNavigation = createContext<(path: string) => void>(() => {});
export function Link({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  const navigate = useContext(OfferingNavigation);
  return <a href={to} className={className} onClick={(event) => { event.preventDefault(); navigate(to); }}>{children}</a>;
}
