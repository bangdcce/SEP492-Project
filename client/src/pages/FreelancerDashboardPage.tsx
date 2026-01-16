import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Search, Filter, DollarSign, Clock, MapPin, Star, TrendingUp, CheckCircle2, AlertCircle, Settings } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/custom/input';
import { ROUTES, STORAGE_KEYS } from '@/constants';

interface Job {
  id: string;
  title: string;
  description: string;
  budget: number;
  duration: string;
  location: string;
  skills: string[];
  postedAt: string;
  client: {
    name: string;
    rating: number;
    completedProjects: number;
  };
}

interface DashboardStats {
  activeProjects: number;
  totalEarnings: number;
  completedProjects: number;
  profileViews: number;
}

export default function FreelancerDashboardPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [userSkills, setUserSkills] = useState<string[]>([]);
  
  // Mock data - Replace with API calls later
  const [stats] = useState<DashboardStats>({
    activeProjects: 2,
    totalEarnings: 15750,
    completedProjects: 12,
    profileViews: 234,
  });

  const [jobs] = useState<Job[]>([
    {
      id: '1',
      title: 'React Developer for E-commerce Platform',
      description: 'Looking for an experienced React developer to build a modern e-commerce platform with payment integration.',
      budget: 5000,
      duration: '2-3 months',
      location: 'Remote',
      skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
      postedAt: '2 hours ago',
      client: {
        name: 'TechCorp Vietnam',
        rating: 4.8,
        completedProjects: 24,
      },
    },
    {
      id: '2',
      title: 'Full Stack Developer - CRM System',
      description: 'Need a full stack developer to customize and extend our existing CRM system with new features.',
      budget: 7500,
      duration: '3-4 months',
      location: 'Hybrid - Ho Chi Minh City',
      skills: ['React', 'Node.js', 'MongoDB', 'AWS'],
      postedAt: '1 day ago',
      client: {
        name: 'SmartBiz Solutions',
        rating: 4.9,
        completedProjects: 31,
      },
    },
    {
      id: '3',
      title: 'UI/UX Designer for Mobile App',
      description: 'Seeking a creative UI/UX designer to design a mobile app for food delivery service.',
      budget: 3000,
      duration: '1-2 months',
      location: 'Remote',
      skills: ['Figma', 'UI/UX Design', 'Mobile Design'],
      postedAt: '3 days ago',
      client: {
        name: 'FoodHub',
        rating: 4.5,
        completedProjects: 8,
      },
    },
  ]);

  useEffect(() => {
    // Load user skills from localStorage
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserSkills(user.skills || []);
    }
  }, []);

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSkills = selectedSkills.length === 0 || 
                         selectedSkills.some(skill => job.skills.includes(skill));
    
    return matchesSearch && matchesSkills;
  });

  const handleCompleteProfile = () => {
    navigate(ROUTES.FREELANCER_ONBOARDING);
  };

  const isProfileIncomplete = userSkills.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Profile Incomplete Banner */}
      {isProfileIncomplete && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-900">
                    Complete your profile to start receiving job offers
                  </p>
                  <p className="text-xs text-amber-700">
                    Add your skills, portfolio, and experience to unlock all features
                  </p>
                </div>
              </div>
              <Button onClick={handleCompleteProfile} size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">
                Complete Profile
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Freelancer Dashboard</h1>
          <p className="text-gray-600">Find projects that match your skills and expertise</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Active Projects</span>
              <Briefcase className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.activeProjects}</div>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              In progress
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Total Earnings</span>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              ${stats.totalEarnings.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">This month: $2,450</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Completed</span>
              <CheckCircle2 className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.completedProjects}</div>
            <p className="text-xs text-gray-500 mt-1">100% success rate</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Profile Views</span>
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.profileViews}</div>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +12% this week
            </p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for jobs..."
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="md:w-auto">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Skill Filter Pills */}
          {userSkills.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">Filter by your skills:</p>
              <div className="flex flex-wrap gap-2">
                {userSkills.map((skill) => (
                  <button
                    key={skill}
                    onClick={() => {
                      setSelectedSkills(prev =>
                        prev.includes(skill)
                          ? prev.filter(s => s !== skill)
                          : [...prev, skill]
                      );
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedSkills.includes(skill)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {skill}
                  </button>
                ))}
                {selectedSkills.length > 0 && (
                  <button
                    onClick={() => setSelectedSkills([])}
                    className="px-3 py-1.5 rounded-full text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Jobs List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Available Jobs ({filteredJobs.length})
            </h2>
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Job Preferences
            </Button>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
              <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
              <p className="text-gray-600">Try adjusting your search or filters</p>
            </div>
          ) : (
            filteredJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{job.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${job.budget.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {job.duration}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {job.location}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap ml-4">{job.postedAt}</span>
                </div>

                <p className="text-gray-700 mb-4 line-clamp-2">{job.description}</p>

                {/* Skills */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {job.skills.map((skill) => (
                    <span
                      key={skill}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        userSkills.includes(skill)
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {skill}
                      {userSkills.includes(skill) && ' ✓'}
                    </span>
                  ))}
                </div>

                {/* Client Info & CTA */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-600">
                        {job.client.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{job.client.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          {job.client.rating}
                        </span>
                        <span>•</span>
                        <span>{job.client.completedProjects} projects</span>
                      </div>
                    </div>
                  </div>
                  <Button size="sm">
                    View Details
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
