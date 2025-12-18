import React from 'react';
import { Bell, ChevronRight } from 'lucide-react';

interface HeaderProps {
  breadcrumbs: string[];
  userName?: string;
  userAvatar?: string;
}

export const Header: React.FC<HeaderProps> = ({ 
  breadcrumbs, 
  userName = 'Admin User',
  userAvatar = 'https://ui-avatars.com/api/?name=Admin+User&background=14b8a6&color=fff'
}) => {
  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-4">
      <div className="flex items-center justify-between">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
              <span
                className={
                  index === breadcrumbs.length - 1
                    ? 'text-slate-900'
                    : 'text-gray-500'
                }
              >
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* User Profile & Notifications */}
        <div className="flex items-center gap-4">
          {/* Notification Bell */}
          <button className="relative p-2 text-gray-500 hover:text-slate-900 hover:bg-gray-50 rounded-lg transition-colors">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
            <img
              src={userAvatar}
              alt={userName}
              className="h-9 w-9 rounded-full"
            />
            <div className="text-sm">
              <p className="text-slate-900">{userName}</p>
              <p className="text-gray-500 text-xs">Administrator</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
