/**
 * ClientFooter Component
 * Shared footer wrapper for dashboard layouts
 */

import React from "react";
import { SiteFooter } from "../site/SiteFooter";

export const ClientFooter: React.FC = () => {
  return <SiteFooter tone="light" className="mt-12" />;
};
