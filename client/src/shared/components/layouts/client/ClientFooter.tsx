/**
 * ClientFooter Component
 * Footer for client dashboard pages
 */

import React from "react";
import { Link } from "react-router-dom";

export const ClientFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="font-semibold text-gray-700">InterDev</span>
            <span className="text-gray-300">|</span>
            <span>(c) {currentYear} InterDev</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
            <Link
              to="/help"
              className="hover:text-teal-700 transition-colors"
            >
              Help
            </Link>
            <Link
              to="/privacy"
              className="hover:text-teal-700 transition-colors"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="hover:text-teal-700 transition-colors"
            >
              Terms
            </Link>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
              Trust Score Verified
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
