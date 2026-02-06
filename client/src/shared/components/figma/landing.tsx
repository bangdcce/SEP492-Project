import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  Briefcase,
  Laptop,
  CheckCircle,
  Users,
  Zap,
  Shield,
  TrendingUp,
  Star,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';

interface LandingPageProps {
  onNavigateToSignIn: () => void;
  onNavigateToSignUp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigateToSignIn,
  onNavigateToSignUp,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const roles = [
    {
      icon: Building2,
      title: 'Business Owners',
      subtitle: 'SME Companies',
      description: 'Find the perfect development team for your software projects. Post requirements and connect with verified freelancers.',
      gradient: 'from-teal-500 to-teal-600',
      features: ['Post project requirements', 'Verified freelancer network', 'Project management tools'],
      image: 'https://images.unsplash.com/photo-1758518730178-6e237bc8b87d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMHRlYW0lMjBjb2xsYWJvcmF0aW9uJTIwb2ZmaWNlfGVufDF8fHx8MTc3MDI4OTEzMnww&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      icon: Briefcase,
      title: 'Brokers',
      subtitle: 'Project Intermediaries',
      description: 'Bridge the gap between businesses and developers. Translate requirements and ensure smooth project execution.',
      gradient: 'from-blue-500 to-blue-600',
      features: ['Requirement translation', 'Project coordination', 'Commission-based earnings'],
      image: 'https://images.unsplash.com/photo-1745847768380-2caeadbb3b71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMGhhbmRzaGFrZSUyMHBhcnRuZXJzaGlwfGVufDF8fHx8MTc3MDIzMzk1NXww&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      icon: Laptop,
      title: 'Freelancers',
      subtitle: 'Software Developers',
      description: 'Access quality projects from verified businesses. Build your portfolio and grow your freelance career.',
      gradient: 'from-green-500 to-green-600',
      features: ['Quality project opportunities', 'Secure payments', 'Portfolio building'],
      image: 'https://images.unsplash.com/photo-1607971422532-73f9d45d7a47?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzb2Z0d2FyZSUyMGRldmVsb3BlciUyMGNvZGluZyUyMGxhcHRvcHxlbnwxfHx8fDE3NzAyMTEyODh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
  ];

  const features = [
    {
      icon: Shield,
      title: 'Verified Users',
      description: 'All users go through KYC verification for trust and security.',
    },
    {
      icon: Zap,
      title: 'Fast Matching',
      description: 'AI-powered matching connects the right people for your projects.',
    },
    {
      icon: Users,
      title: 'Collaborative Tools',
      description: 'Built-in project management and communication features.',
    },
    {
      icon: TrendingUp,
      title: 'Growth Focused',
      description: 'Analytics and insights to help you scale your business.',
    },
  ];

  const stats = [
    { value: '10K+', label: 'Active Users' },
    { value: '5K+', label: 'Projects Completed' },
    { value: '98%', label: 'Success Rate' },
    { value: '24/7', label: 'Support' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-b border-slate-200 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <img
                src="/assets/logo/Logo.png"
                alt="ConnectHub Logo"
                className="h-50 w-auto"
              />
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-slate-700 hover:text-teal-600 transition-colors">
                Features
              </a>
              <a href="#roles" className="text-slate-700 hover:text-teal-600 transition-colors">
                For You
              </a>
              <a href="#how-it-works" className="text-slate-700 hover:text-teal-600 transition-colors">
                How It Works
              </a>
              <button
                onClick={onNavigateToSignIn}
                className="px-4 py-2 text-slate-700 hover:text-teal-600 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={onNavigateToSignUp}
                className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl hover:from-teal-600 hover:to-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Get Started
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-slate-200 bg-white"
          >
            <div className="px-4 py-4 space-y-3">
              <a
                href="#features"
                className="block px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </a>
              <a
                href="#roles"
                className="block px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                For You
              </a>
              <a
                href="#how-it-works"
                className="block px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                How It Works
              </a>
              <button
                onClick={onNavigateToSignIn}
                className="w-full px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-left"
              >
                Sign In
              </button>
              <button
                onClick={onNavigateToSignUp}
                className="w-full px-6 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl hover:from-blue-700 hover:to-teal-700 transition-all duration-200"
              >
                Get Started
              </button>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-teal-700 rounded-full text-sm font-medium">
                <Star className="w-4 h-4 fill-current" />
                Trusted by 10,000+ Users
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 leading-tight">
                Connect.
                <br />
                <span className="bg-gradient-to-r from-teal-500 to-teal-600 bg-clip-text text-transparent">
                  Collaborate.
                </span>
                <br />
                Create.
              </h1>

              <p className="text-xl text-slate-600 leading-relaxed">
                The ultimate platform connecting SME businesses, brokers, and freelancers.
                Transform your ideas into reality with verified professionals.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onNavigateToSignUp}
                  className="px-8 py-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl hover:from-blue-700 hover:to-teal-700 transition-all duration-200 shadow-xl hover:shadow-2xl flex items-center justify-center gap-2 text-lg font-semibold"
                >
                  Start For Free
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onNavigateToSignIn}
                  className="px-8 py-4 bg-white text-slate-700 border-2 border-slate-300 rounded-xl hover:border-teal-600 hover:text-teal-600 transition-all duration-200 flex items-center justify-center gap-2 text-lg font-semibold"
                >
                  Sign In
                  <ChevronRight className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-8">
                {stats.map((stat, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    className="text-center"
                  >
                    <div className="text-3xl font-bold bg-gradient-to-r from-teal-500 to-teal-600 bg-clip-text text-transparent">
                      {stat.value}
                    </div>
                    <div className="text-sm text-slate-600 mt-1">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-teal-600 rounded-3xl blur-3xl opacity-20"></div>
              <img
                src="https://images.unsplash.com/photo-1718220216044-006f43e3a9b1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBvZmZpY2UlMjB3b3Jrc3BhY2V8ZW58MXx8fHwxNzcwMjYzODQ0fDA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Modern workspace"
                className="relative rounded-3xl shadow-2xl"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
              Why Choose InterDev?
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Everything you need to manage projects and collaborate effectively
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -8 }}
                className="bg-gradient-to-br from-slate-50 to-white p-8 rounded-2xl border border-slate-200 hover:border-teal-300 transition-all duration-300 shadow-sm hover:shadow-xl"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section id="roles" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
              Built For Everyone
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Whether you're a business owner, broker, or freelancer, we've got you covered
            </p>
          </motion.div>

          <div className="space-y-12">
            {roles.map((role, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className={`grid lg:grid-cols-2 gap-8 items-center ${index % 2 === 1 ? 'lg:flex-row-reverse' : ''
                  }`}
              >
                <div className={`space-y-6 ${index % 2 === 1 ? 'lg:order-2' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-4 bg-gradient-to-r ${role.gradient} rounded-2xl`}>
                      <role.icon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <div className="text-sm text-slate-600">{role.subtitle}</div>
                      <h3 className="text-3xl font-bold text-slate-900">{role.title}</h3>
                    </div>
                  </div>

                  <p className="text-lg text-slate-600 leading-relaxed">{role.description}</p>

                  <ul className="space-y-3">
                    {role.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-center gap-3">
                        <div className={`w-6 h-6 bg-gradient-to-r ${role.gradient} rounded-full flex items-center justify-center flex-shrink-0`}>
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-slate-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onNavigateToSignUp}
                    className={`px-6 py-3 bg-gradient-to-r ${role.gradient} text-white rounded-xl hover:shadow-xl transition-all duration-200 inline-flex items-center gap-2`}
                  >
                    Get Started as {role.title}
                    <ArrowRight className="w-5 h-5" />
                  </motion.button>
                </div>

                <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                  <div className="relative">
                    <div className={`absolute inset-0 bg-gradient-to-r ${role.gradient} rounded-3xl blur-2xl opacity-20`}></div>
                    <img
                      src={role.image}
                      alt={role.title}
                      className="relative rounded-3xl shadow-2xl"
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Get started in three simple steps
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Create Account',
                description: 'Sign up and complete KYC verification to join our trusted community.',
              },
              {
                step: '02',
                title: 'Connect & Match',
                description: 'Find the perfect match for your needs with our AI-powered matching system.',
              },
              {
                step: '03',
                title: 'Collaborate & Succeed',
                description: 'Use our built-in tools to manage projects and achieve your goals.',
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <div className="text-center space-y-4">
                  <div className="text-6xl font-bold bg-gradient-to-r from-teal-500 to-teal-600 bg-clip-text text-transparent opacity-20">
                    {item.step}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">{item.title}</h3>
                  <p className="text-slate-600">{item.description}</p>
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-12 right-0 translate-x-1/2">
                    <ChevronRight className="w-8 h-8 text-slate-300" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-teal-500 to-teal-600">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-white">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-white/90">
              Join thousands of businesses, brokers, and freelancers already growing with InterDev
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onNavigateToSignUp}
                className="px-8 py-4 bg-white text-teal-600 rounded-xl hover:bg-slate-50 transition-all duration-200 shadow-xl hover:shadow-2xl flex items-center justify-center gap-2 text-lg font-semibold"
              >
                Create Free Account
                <ArrowRight className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onNavigateToSignIn}
                className="px-8 py-4 bg-white/10 text-white border-2 border-white/30 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-all duration-200 flex items-center justify-center gap-2 text-lg font-semibold"
              >
                Sign In
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 ">
            <div className="flex flex-col ">
              <img
                src="/assets/logo/Logo.png"
                alt="ConnectHub Logo"
                className="h-50 w-[300px] object-contain -mt-16"
              />
              <p className="text-slate-400 m-0 -mt-15 ml-8">
                Connecting businesses, brokers, and freel6ncers for successful projects.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#roles" className="hover:text-white transition-colors">For You</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-12 pt-8 text-center text-slate-400">
            <p>&copy; 2026 InterDev. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};


