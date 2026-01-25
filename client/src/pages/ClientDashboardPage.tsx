/**
 * Client Dashboard Page
 * Main dashboard for client users (freelancers/brokers/clients)
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  FolderKanban,
  MessageSquare,
  Star,
  DollarSign,
  Clock,
  ArrowRight,
} from "lucide-react";
import { STORAGE_KEYS, ROUTES } from "@/constants";
import { getStoredJson } from "@/shared/utils/storage";

interface UserData {
  fullName?: string;
  currentTrustScore?: number | string;
}

// Get initial user from storage (session/local)
const getInitialUser = (): UserData => {
  return getStoredJson<UserData>(STORAGE_KEYS.USER) || {};
};

export default function ClientDashboardPage() {
  const [user, setUser] = useState<UserData>(getInitialUser);

  useEffect(() => {
    // Listen for user data updates
    const handleUserUpdate = () => {
      const updatedUser = getStoredJson<UserData>(STORAGE_KEYS.USER);
      if (updatedUser) setUser(updatedUser);
    };

    window.addEventListener("userDataUpdated", handleUserUpdate);
    return () =>
      window.removeEventListener("userDataUpdated", handleUserUpdate);
  }, []);

  const userName = user.fullName || "User";
  const trustScore = Number(user.currentTrustScore) || 0;

  // Mock stats - will be replaced with real API data
  const stats = [
    {
      label: "Active Projects",
      value: "3",
      icon: FolderKanban,
      color: "teal",
      change: "+2 this month",
    },
    {
      label: "Trust Score",
      value: trustScore.toFixed(1),
      icon: Star,
      color: "yellow",
      change: "View profile",
    },
    {
      label: "Total Earnings",
      value: "$12,450",
      icon: DollarSign,
      color: "green",
      change: "+15% from last month",
    },
    {
      label: "Unread Messages",
      value: "5",
      icon: MessageSquare,
      color: "blue",
      change: "2 new today",
    },
  ];

  const recentProjects = [
    {
      id: 1,
      title: "E-commerce Website Redesign",
      client: "TechCorp Inc.",
      status: "in-progress",
      deadline: "2025-01-20",
      progress: 65,
    },
    {
      id: 2,
      title: "Mobile App Development",
      client: "StartupXYZ",
      status: "in-progress",
      deadline: "2025-02-05",
      progress: 40,
    },
    {
      id: 3,
      title: "Logo & Brand Identity",
      client: "Creative Agency",
      status: "review",
      deadline: "2025-01-15",
      progress: 90,
    },
  ];

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      "in-progress": "bg-teal-100 text-teal-700",
      review: "bg-yellow-100 text-yellow-700",
      completed: "bg-green-100 text-green-700",
    };
    return badges[status] || "bg-gray-100 text-gray-700";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      "in-progress": "In Progress",
      review: "In Review",
      completed: "Completed",
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Welcome back, {userName}! 👋
        </h1>
        <p className="text-gray-600">
          Here's what's happening with your projects today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    stat.color === "teal"
                      ? "bg-teal-100"
                      : stat.color === "yellow"
                      ? "bg-yellow-100"
                      : stat.color === "green"
                      ? "bg-green-100"
                      : "bg-blue-100"
                  }`}
                >
                  <Icon
                    className={`w-6 h-6 ${
                      stat.color === "teal"
                        ? "text-teal-600"
                        : stat.color === "yellow"
                        ? "text-yellow-600"
                        : stat.color === "green"
                        ? "text-green-600"
                        : "text-blue-600"
                    }`}
                  />
                </div>
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-gray-600 mb-2">{stat.label}</div>
              <div className="text-xs text-gray-500">{stat.change}</div>
            </div>
          );
        })}
      </div>

      {/* Recent Projects */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Recent Projects
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Track your active project progress
              </p>
            </div>
            <Link
              to={ROUTES.MY_REQUESTS}
              className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 transition-colors"
            >
              View all
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {recentProjects.map((project) => (
            <div
              key={project.id}
              className="p-6 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-slate-900 mb-1">
                    {project.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Client: {project.client}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusBadge(
                    project.status
                  )}`}
                >
                  {getStatusLabel(project.status)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Progress</span>
                  <span className="text-sm font-medium text-slate-900">
                    {project.progress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              {/* Deadline */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>
                  Deadline: {new Date(project.deadline).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to={ROUTES.MY_REQUESTS}
          className="bg-linear-to-br from-teal-500 to-teal-600 rounded-lg p-6 text-white hover:from-teal-600 hover:to-teal-700 transition-all shadow-md hover:shadow-lg"
        >
          <FolderKanban className="w-8 h-8 mb-3" />
          <h3 className="text-lg font-semibold mb-2">My Requests</h3>
          <p className="text-sm text-teal-100">View your project requests</p>
        </Link>

        <Link
          to="/messages"
          className="bg-linear-to-br from-slate-700 to-slate-900 rounded-lg p-6 text-white hover:from-slate-800 hover:to-slate-950 transition-all shadow-md hover:shadow-lg"
        >
          <MessageSquare className="w-8 h-8 mb-3" />
          <h3 className="text-lg font-semibold mb-2">Messages</h3>
          <p className="text-sm text-slate-300">5 unread messages</p>
        </Link>

        <Link
          to={ROUTES.PROFILE}
          className="bg-linear-to-br from-yellow-500 to-yellow-600 rounded-lg p-6 text-white hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-md hover:shadow-lg"
        >
          <Star className="w-8 h-8 mb-3" />
          <h3 className="text-lg font-semibold mb-2">My Profile</h3>
          <p className="text-sm text-yellow-100">
            Trust Score: {trustScore.toFixed(1)}/5.0
          </p>
        </Link>
      </div>
    </div>
  );
}
