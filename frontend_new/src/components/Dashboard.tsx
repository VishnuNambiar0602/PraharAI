import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import {
  Sparkles,
  TrendingUp,
  FileText,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
  Clock,
  Target,
  Award,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { Scheme } from '../types';
import { fetchSchemes } from '../api';

interface DashboardProps {
  user: any;
  onNavigate: (view: string) => void;
}

export default function Dashboard({ user, onNavigate }: DashboardProps) {
  const [recommendations, setRecommendations] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      // Fetch top schemes - in production this would be personalized
      const data = await fetchSchemes(undefined, 5);
      const list: Scheme[] = Array.isArray(data)
        ? data
        : (data.schemes ?? data.data ?? data.value ?? []);
      setRecommendations(list.slice(0, 5));
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate profile completeness
  const profileFields = [
    user.name,
    user.email,
    user.age,
    user.state,
    user.occupation,
    user.income,
    user.education,
    user.gender,
  ];
  const filledFields = profileFields.filter(Boolean).length;
  const completeness = Math.round((filledFields / profileFields.length) * 100);

  const stats = [
    {
      label: 'Profile Complete',
      value: `${completeness}%`,
      icon: Target,
      color: 'text-accent',
      bgColor: 'bg-accent-50',
    },
    {
      label: 'Schemes Viewed',
      value: '0',
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary-50',
    },
    {
      label: 'Applications',
      value: '0',
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success-50',
    },
  ];

  return (
    <div className="min-h-screen bg-surface">
      {/* Hero Section */}
      <div className="bg-linear-to-br from-primary via-primary-800 to-primary-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="size-6 text-accent" />
              <span className="text-accent-100 text-sm font-semibold uppercase tracking-wide">
                Welcome Back
              </span>
            </div>
            <h1 className="font-display text-4xl lg:text-5xl font-bold mb-3">
              Hello, {user.name || 'User'}! 👋
            </h1>
            <p className="text-primary-100 text-lg max-w-2xl">
              Discover personalized government schemes tailored just for you. Your journey to
              government benefits starts here.
            </p>
          </motion.div>

          {/* Quick Stats */}
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            {stats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 + 0.2 }}
              >
                <Card className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/15 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-primary-100 text-sm font-medium mb-1">{stat.label}</p>
                        <p className="text-3xl font-bold text-white">{stat.value}</p>
                      </div>
                      <div className={`${stat.bgColor} ${stat.color} p-3 rounded-xl`}>
                        <stat.icon className="size-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Recommendations */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Completeness */}
            {completeness < 100 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-accent bg-accent-50/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">Complete Your Profile</CardTitle>
                        <CardDescription className="mt-1">
                          {completeness}% complete - Add more details to get better recommendations
                        </CardDescription>
                      </div>
                      <Award className="size-8 text-accent" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-accent"
                          initial={{ width: 0 }}
                          animate={{ width: `${completeness}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                        />
                      </div>
                      <span className="text-sm font-bold text-accent">{completeness}%</span>
                    </div>
                    <Button variant="accent" size="sm" onClick={() => onNavigate('profile')}>
                      Complete Profile
                      <ArrowRight className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Recommended Schemes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="size-5 text-primary" />
                    Recommended for You
                  </CardTitle>
                  <CardDescription>Top schemes based on your profile</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loading && (
                    <>
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <div key={idx} className="p-4 border border-border rounded-lg">
                          <Skeleton className="h-5 w-3/4 mb-2" />
                          <Skeleton className="h-4 w-full mb-1" />
                          <Skeleton className="h-4 w-2/3" />
                        </div>
                      ))}
                    </>
                  )}

                  {!loading &&
                    recommendations.map((scheme, idx) => (
                      <motion.div
                        key={scheme.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="p-4 border border-border rounded-lg hover:border-primary hover:shadow-md transition-all cursor-pointer"
                        onClick={() => onNavigate('schemes')}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h4 className="font-bold text-ink text-sm flex-1 leading-snug">
                            {scheme.title}
                          </h4>
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {scheme.category || 'General'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted line-clamp-2">
                          {scheme.description || 'Government benefit scheme'}
                        </p>
                      </motion.div>
                    ))}

                  {!loading && recommendations.length === 0 && (
                    <div className="text-center py-8 text-muted">
                      <FileText className="size-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No recommendations available yet</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => onNavigate('schemes')}
                      >
                        Browse All Schemes
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Right Column - Quick Actions */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => onNavigate('schemes')}
                  >
                    <FileText className="size-4" />
                    Browse All Schemes
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => onNavigate('assistant')}
                  >
                    <MessageSquare className="size-4" />
                    AI Assistant
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => onNavigate('profile')}
                  >
                    <Target className="size-4" />
                    Update Profile
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent Activity */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="size-5 text-muted" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted">
                    <Clock className="size-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No recent activity</p>
                    <p className="text-xs mt-1">
                      Start exploring schemes to see your activity here
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
