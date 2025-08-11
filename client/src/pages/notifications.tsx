import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { isUnauthorizedError } from '@/lib/authUtils';
import Navbar from '@/components/layout/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Bell, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Info, 
  XCircle,
  Train,
  RefreshCw,
  Filter,
  MarkAsRead
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { UserNotification } from '@shared/schema';

const severityConfig = {
  low: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950' },
  medium: { icon: Bell, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950' },
  high: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950' },
  critical: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950' },
};

const typeConfig = {
  delay: { label: 'Delay Alert', icon: Clock },
  cancellation: { label: 'Cancellation', icon: XCircle },
  compensation: { label: 'Compensation', icon: CheckCircle },
  route_change: { label: 'Route Change', icon: Train },
  maintenance: { label: 'Maintenance', icon: Info },
};

export default function Notifications() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/notifications'],
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
    }
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiRequest('PATCH', `/api/notifications/${notificationId}/read`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Failed to Update",
        description: "Could not mark notification as read.",
        variant: "destructive",
      });
    }
  });

  // Test notification mutation
  const testNotificationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/notifications/test');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Test Notification Sent",
        description: "Check your notification settings to see if it worked.",
      });
      // Refetch notifications after a short delay
      setTimeout(() => {
        refetch();
      }, 1000);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Test Failed",
        description: "Could not send test notification.",
        variant: "destructive",
      });
    }
  });

  const unreadCount = notifications.filter((n: UserNotification) => !n.isRead).length;

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Notifications
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Stay updated with your transit alerts and system messages
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              onClick={() => testNotificationMutation.mutate()}
              disabled={testNotificationMutation.isPending}
            >
              <Bell className="h-4 w-4 mr-2" />
              Test Notification
            </Button>
          </div>
        </div>

        {/* Stats Card */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{notifications.length}</div>
                <div className="text-sm text-gray-500">Total Notifications</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">{unreadCount}</div>
                <div className="text-sm text-gray-500">Unread</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {notifications.length - unreadCount}
                </div>
                <div className="text-sm text-gray-500">Read</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Notifications Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                You'll see transit alerts, delay notifications, and system updates here.
              </p>
              <Button onClick={() => testNotificationMutation.mutate()}>
                <Bell className="h-4 w-4 mr-2" />
                Send Test Notification
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification: UserNotification) => {
              const severity = severityConfig[notification.severity];
              const type = typeConfig[notification.type];
              const SeverityIcon = severity.icon;
              const TypeIcon = type.icon;

              return (
                <Card key={notification.id} className={`${!notification.isRead ? 'ring-2 ring-blue-200 dark:ring-blue-800' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={`p-2 rounded-full ${severity.bg}`}>
                        <SeverityIcon className={`h-4 w-4 ${severity.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h3 className={`font-medium ${!notification.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                              {notification.title}
                            </h3>
                            <Badge variant="outline" className="text-xs">
                              <TypeIcon className="h-3 w-3 mr-1" />
                              {type.label}
                            </Badge>
                            {!notification.isRead && (
                              <Badge variant="default" className="text-xs bg-blue-100 text-blue-800">
                                New
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </span>
                            {!notification.isRead && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsReadMutation.mutate(notification.id)}
                                disabled={markAsReadMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                          {notification.message}
                        </p>

                        {/* Additional info for route/journey specific notifications */}
                        {(notification.routeId || notification.journeyId) && (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              {notification.routeId && (
                                <span>Route: {notification.routeId}</span>
                              )}
                              {notification.journeyId && (
                                <span>Journey: {notification.journeyId}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              About Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Notification Types</h4>
                <ul className="space-y-1 text-gray-600 dark:text-gray-300">
                  <li>• <strong>Delay Alerts:</strong> Transit delays affecting your routes</li>
                  <li>• <strong>Cancellations:</strong> Service disruptions and cancellations</li>
                  <li>• <strong>Compensation:</strong> Eligible delay compensation cases</li>
                  <li>• <strong>Route Changes:</strong> Schedule or route modifications</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Severity Levels</h4>
                <ul className="space-y-1 text-gray-600 dark:text-gray-300">
                  <li>• <strong>Critical:</strong> Major disruptions, immediate action needed</li>
                  <li>• <strong>High:</strong> Significant delays, plan alternatives</li>
                  <li>• <strong>Medium:</strong> Minor delays, moderate impact</li>
                  <li>• <strong>Low:</strong> Information updates, no action needed</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}