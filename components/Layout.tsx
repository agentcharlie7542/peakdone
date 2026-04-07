
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      {children}
    </div>
  );
};
