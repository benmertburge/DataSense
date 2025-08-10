import { Bell, User, Train } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

export default function Navbar() {
  const { user } = useAuth();

  const { data: compensationCases } = useQuery({
    queryKey: ['/api/compensation/cases'],
    enabled: !!user,
  });

  const pendingNotifications = compensationCases?.filter((c: any) => 
    c.status === 'detected' || c.status === 'processing'
  ).length || 0;

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Train className="text-blue-600 text-xl mr-3" />
            <h1 className="text-xl font-bold text-blue-600">TransitPro</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5 text-gray-600" />
              {pendingNotifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingNotifications}
                </span>
              )}
            </Button>
            
            <Button variant="ghost" size="sm">
              <User className="h-5 w-5 text-gray-600" />
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.href = '/api/logout'}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
