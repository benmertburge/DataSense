import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import Navbar from '@/components/layout/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { isUnauthorizedError } from '@/lib/authUtils';
import { 
  Bell, 
  Smartphone, 
  Mail, 
  MessageSquare, 
  Palette, 
  Globe, 
  Clock, 
  Shield,
  User,
  Phone,
  MapPin,
  AlertTriangle
} from 'lucide-react';

interface UserSettings {
  notificationsEnabled: boolean;
  delayAlertsEnabled: boolean;
  alertTimingMinutes: number;
  preferredLanguage: string;
  theme: string;
  pushNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  phone?: string;
  address?: string;
  emergencyContact?: string;
}

export default function Settings() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [settings, setSettings] = useState<UserSettings>({
    notificationsEnabled: true,
    delayAlertsEnabled: true,
    alertTimingMinutes: 15,
    preferredLanguage: 'sv',
    theme: 'light',
    pushNotifications: false,
    emailNotifications: true,
    smsNotifications: false,
  });

  // Fetch user settings
  const { data: userSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['/api/user/settings'],
    enabled: !!user,
    onSuccess: (data) => {
      if (data) {
        setSettings(prev => ({ ...prev, ...data }));
      }
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
    }
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<UserSettings>) => {
      const response = await apiRequest('PATCH', '/api/user/settings', newSettings);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Your preferences have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
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
        title: "Update Failed",
        description: "Failed to update your settings. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Test push notifications
  const testNotificationsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/notifications/test');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Test Notification Sent",
        description: "Check your devices for the test notification.",
      });
    },
    onError: () => {
      toast({
        title: "Test Failed",
        description: "Could not send test notification.",
        variant: "destructive",
      });
    }
  });

  const handleSettingChange = (key: keyof UserSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    updateSettingsMutation.mutate({ [key]: value });
  };

  const handleBulkUpdate = () => {
    updateSettingsMutation.mutate(settings);
  };

  if (isLoading || settingsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage your TransitPro preferences and notifications
          </p>
        </div>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            <CardDescription>
              Your basic profile information and contact details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={user?.firstName || ''}
                  disabled
                  className="bg-gray-50 dark:bg-gray-800"
                />
                <p className="text-xs text-gray-500 mt-1">Synced from your account</p>
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={user?.lastName || ''}
                  disabled
                  className="bg-gray-50 dark:bg-gray-800"
                />
                <p className="text-xs text-gray-500 mt-1">Synced from your account</p>
              </div>
            </div>
            
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="bg-gray-50 dark:bg-gray-800"
              />
              <p className="text-xs text-gray-500 mt-1">Synced from your account</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    placeholder="+46 70 123 45 67"
                    value={settings.phone || ''}
                    onChange={(e) => handleSettingChange('phone', e.target.value)}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">For SMS notifications and emergency contact</p>
              </div>
              
              <div>
                <Label htmlFor="emergencyContact">Emergency Contact</Label>
                <Input
                  id="emergencyContact"
                  placeholder="Emergency contact number"
                  value={settings.emergencyContact || ''}
                  onChange={(e) => handleSettingChange('emergencyContact', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Home Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="address"
                  placeholder="Your home address in Stockholm area"
                  value={settings.address || ''}
                  onChange={(e) => handleSettingChange('address', e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Used for personalized route suggestions</p>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Control how and when you receive transit alerts and updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Master notification toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Bell className="h-5 w-5 text-gray-500" />
                <div>
                  <Label className="text-base font-medium">Enable Notifications</Label>
                  <p className="text-sm text-gray-500">Master control for all notifications</p>
                </div>
              </div>
              <Switch
                checked={settings.notificationsEnabled}
                onCheckedChange={(checked) => handleSettingChange('notificationsEnabled', checked)}
              />
            </div>

            <Separator />

            {/* Delay alerts */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <div>
                  <Label className="text-base font-medium">Delay Alerts</Label>
                  <p className="text-sm text-gray-500">Get notified about delays on your routes</p>
                </div>
              </div>
              <Switch
                checked={settings.delayAlertsEnabled}
                onCheckedChange={(checked) => handleSettingChange('delayAlertsEnabled', checked)}
                disabled={!settings.notificationsEnabled}
              />
            </div>

            {/* Alert timing */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-blue-500" />
                <div>
                  <Label className="text-base font-medium">Alert Timing</Label>
                  <p className="text-sm text-gray-500">How early to notify before departure</p>
                </div>
              </div>
              <Select
                value={settings.alertTimingMinutes.toString()}
                onValueChange={(value) => handleSettingChange('alertTimingMinutes', parseInt(value))}
                disabled={!settings.notificationsEnabled}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="20">20 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Notification channels */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Notification Channels</Label>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Smartphone className="h-5 w-5 text-green-500" />
                  <div>
                    <Label>Push Notifications</Label>
                    <p className="text-sm text-gray-500">Browser and mobile push notifications</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={settings.pushNotifications}
                    onCheckedChange={(checked) => handleSettingChange('pushNotifications', checked)}
                    disabled={!settings.notificationsEnabled}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testNotificationsMutation.mutate()}
                    disabled={!settings.pushNotifications || testNotificationsMutation.isPending}
                  >
                    Test
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-blue-500" />
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-gray-500">Important updates via email</p>
                  </div>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
                  disabled={!settings.notificationsEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                  <div>
                    <Label>SMS Notifications</Label>
                    <p className="text-sm text-gray-500">Critical alerts via SMS</p>
                    {!settings.phone && (
                      <Badge variant="outline" className="mt-1">Phone required</Badge>
                    )}
                  </div>
                </div>
                <Switch
                  checked={settings.smsNotifications}
                  onCheckedChange={(checked) => handleSettingChange('smsNotifications', checked)}
                  disabled={!settings.notificationsEnabled || !settings.phone}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Display Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Display Preferences
            </CardTitle>
            <CardDescription>
              Customize how TransitPro looks and feels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Palette className="h-5 w-5 text-gray-500" />
                <div>
                  <Label className="text-base font-medium">Theme</Label>
                  <p className="text-sm text-gray-500">Choose your preferred appearance</p>
                </div>
              </div>
              <Select
                value={settings.theme}
                onValueChange={(value) => handleSettingChange('theme', value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Globe className="h-5 w-5 text-gray-500" />
                <div>
                  <Label className="text-base font-medium">Language</Label>
                  <p className="text-sm text-gray-500">Interface language</p>
                </div>
              </div>
              <Select
                value={settings.preferredLanguage}
                onValueChange={(value) => handleSettingChange('preferredLanguage', value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sv">Svenska</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacy & Security
            </CardTitle>
            <CardDescription>
              Manage your data and privacy settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Data Usage</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                TransitPro uses authentic Swedish transport data from ResRobot and Trafiklab APIs. 
                Your personal data is encrypted and stored securely. Journey data is anonymized for analytics.
              </p>
            </div>
            
            <div className="flex justify-between items-center pt-4">
              <div>
                <Label className="text-base font-medium">Account Data</Label>
                <p className="text-sm text-gray-500">Download or delete your account data</p>
              </div>
              <div className="space-x-2">
                <Button variant="outline" size="sm">
                  Export Data
                </Button>
                <Button variant="destructive" size="sm">
                  Delete Account
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Changes */}
        <div className="flex justify-end space-x-4">
          <Button
            variant="outline"
            onClick={() => setSettings(userSettings || settings)}
            disabled={updateSettingsMutation.isPending}
          >
            Reset Changes
          </Button>
          <Button
            onClick={handleBulkUpdate}
            disabled={updateSettingsMutation.isPending}
          >
            {updateSettingsMutation.isPending ? 'Saving...' : 'Save All Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}